import { AppearanceChangeType, BoneName, BoneState, GetLogger } from 'pandora-common';
import type { LayerState } from './def';
import { AtomicCondition, TransformDefinition } from 'pandora-common/dist/assets';
import { Container } from 'pixi.js';
import { AppearanceContainer } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { GraphicsManager } from '../assets/graphicsManager';

const logger = GetLogger('GraphicsCharacter');

export class GraphicsCharacter<ContainerType extends AppearanceContainer = AppearanceContainer> extends Container {
	public graphicsManager: GraphicsManager | undefined;
	protected readonly appearanceContainer: ContainerType;
	private _layers: LayerState[] = [];
	private _pose: Record<BoneName, number> = {};

	constructor(appearanceContainer: ContainerType) {
		super();

		this.sortableChildren = true;

		this.appearanceContainer = appearanceContainer;

		const cleanup = this.appearanceContainer.on('appearanceUpdate', (changes) => this.update(changes));
		this.on('destroy', cleanup);
	}

	public setManager(graphicsManager: GraphicsManager) {
		this.graphicsManager = graphicsManager;
		this.update(['items', 'pose']);
	}

	protected update(changes: AppearanceChangeType[]): void {
		let update = false;
		if (changes.includes('items')) {
			this._layers = this.buildLayers();
			update = true;
		}
		const updatedBones = new Set<string>();
		if (changes.includes('pose')) {
			const newPose = this.appearanceContainer.appearance.getFullPose();
			for (const bone of newPose) {
				if (this._pose[bone.definition.name] !== bone.rotation) {
					updatedBones.add(bone.definition.name);
					update = true;
					this._pose[bone.definition.name] = bone.rotation;
				}
			}
		}
		if (update) {
			this.layerUpdate(updatedBones);
		}
	}

	protected buildLayers(): LayerState[] {
		if (!this.graphicsManager)
			return [];
		const result: LayerState[] = [];
		for (const item of this.appearanceContainer.appearance.getAllItems()) {
			if (!item.asset.definition.hasGraphics)
				continue;
			const graphics = this.graphicsManager.getAssetGraphicsById(item.asset.id);
			if (!graphics) {
				logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				continue;
			}
			graphics.allLayers.forEach((layer, index) => {
				result.push({
					asset: graphics,
					layer,
					index,
				});
			});
		}
		return result;
	}

	protected createLayer = GraphicsLayer.create;
	private _graphicsLayers = new Map<string, GraphicsLayer>();
	protected layerUpdate(bones: Set<string>): void {
		this._evalCacheClear();
		const keys = new Set<string>();
		for (const { asset, layer, state, index } of this._layers) {
			const key = `${asset.id}-${index}`;
			keys.add(key);
			let graphics = this._graphicsLayers.get(key);
			if (!graphics) {
				this._graphicsLayers.set(key, graphics = this.createLayer({ layer, state, character: this, transform: this.evalTransform, evaluate: this.evalCondition }));
				this.addChild(graphics);
			} else {
				graphics.update({ bones, state });
			}
		}
		for (const [key, graphics] of this._graphicsLayers) {
			if (!keys.has(key)) {
				this._graphicsLayers.delete(key);
				this.removeChild(graphics);
				graphics.destroy();
			}
		}
		this.sortChildren();
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	protected evalCondition = this._evalCondition.bind(this);
	private _evalCondition(condition: AtomicCondition): boolean {
		const key = `${condition.bone}-${condition.operator}-${condition.value}`;
		let result = this._evalCache.get(key);
		if (result === undefined) {
			const bone = this.getBone(condition.bone);
			this._evalCache.set(key, result = this._evalConditionCore(condition, bone));
		}
		return result;
	}
	private _evalCacheClear = (): void => this._evalCache.clear();
	private _evalConditionCore({ operator, value }: AtomicCondition, { rotation }: BoneState): boolean {
		switch (operator) {
			case '>':
				return rotation > value;
			case '<':
				return rotation < value;
			case '=':
				return rotation === value;
			case '!=':
				return rotation !== value;
			case '>=':
				return rotation >= value;
			case '<=':
				return rotation <= value;
		}
		throw new Error(`_evalConditionCore invalid operator: ${operator as string}`);
	}
	protected evalTransform = this._evalTransform.bind(this);
	private _evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[]): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, bone: boneName, condition } = transform;
			const bone = this.getBone(boneName);
			if (condition && !EvaluateCondition(condition, this.evalCondition)) {
				continue;
			}
			switch (type) {
				case 'rotate': {
					let vecX = resX - bone.definition.x;
					let vecY = resY - bone.definition.y;
					const value = transform.value * bone.rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.definition.x + vecX;
					resY = bone.definition.y + vecY;
					break;
				}
				case 'shift': {
					const percent = bone.rotation / 180;
					resX += percent * transform.value.x;
					resY += percent * transform.value.y;
					break;
				}
			}
		}
		return [resX, resY];
	}
	//#endregion

	private getBone(name: string): BoneState {
		return this.appearanceContainer.appearance.getPose(name);
	}
}
