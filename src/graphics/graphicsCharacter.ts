import { AppearanceChangeType, BoneName, BoneState, GetLogger, AssetId, LayerPriority } from 'pandora-common';
import { LayerState, PRIORITY_ORDER_ARMS_FRONT } from './def';
import { AtomicCondition, TransformDefinition } from 'pandora-common/dist/assets';
import { Container } from 'pixi.js';
import { AppearanceContainer } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';

const logger = GetLogger('GraphicsCharacter');

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;

export class GraphicsCharacter<ContainerType extends AppearanceContainer = AppearanceContainer> extends Container {
	protected graphicsGetter: GraphicsGetterFunction | undefined;
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

	public useGraphics(graphicsGetter: GraphicsGetterFunction) {
		this.graphicsGetter = graphicsGetter;
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
		if (!this.graphicsGetter)
			return [];
		const result: LayerState[] = [];
		for (const item of this.appearanceContainer.appearance.getAllItems()) {
			if (!item.asset.definition.hasGraphics)
				continue;
			const graphics = this.graphicsGetter(item.asset.id);
			if (!graphics) {
				logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				continue;
			}
			result.push(
				...graphics.allLayers.map((layer) => ({
					layer,
				})),
			);
		}
		return result;
	}

	public getSortOrder(): readonly LayerPriority[] {
		return PRIORITY_ORDER_ARMS_FRONT;
	}

	protected sortLayers(toSort: LayerState[]): LayerState[] {
		const sortOrder = this.getSortOrder();
		return toSort.sort((a, b) => {
			const aPriority = sortOrder.indexOf(a.layer.definition.priority);
			const bPriority = sortOrder.indexOf(b.layer.definition.priority);
			return aPriority - bPriority;
		});
	}

	protected createLayer(layer: AssetGraphicsLayer): GraphicsLayer {
		return new GraphicsLayer(layer, this);
	}

	private _graphicsLayers = new Map<LayerState, GraphicsLayer>();
	protected layerUpdate(bones: Set<string>): void {
		this._evalCache.clear();
		for (const [key, graphics] of this._graphicsLayers) {
			if (!this._layers.includes(key)) {
				this._graphicsLayers.delete(key);
				this.removeChild(graphics);
				graphics.destroy();
			}
		}
		this.sortLayers(this._layers.slice()).forEach((layerState, index) => {
			let graphics = this._graphicsLayers.get(layerState);
			if (!graphics) {
				graphics = this.createLayer(layerState.layer);
				this._graphicsLayers.set(layerState, graphics);
				this.addChild(graphics);
				graphics.update({ state: layerState.state, force: true });
			} else {
				graphics.update({ state: layerState.state, bones });
			}
			graphics.zIndex = index;
		});
		this.sortChildren();
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: AtomicCondition): boolean {
		const key = `${condition.bone}-${condition.operator}-${condition.value}`;
		let result = this._evalCache.get(key);
		if (result === undefined) {
			const bone = this.getBone(condition.bone);
			this._evalCache.set(key, result = this._evalConditionCore(condition, bone));
		}
		return result;
	}
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
	public evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[], _mirror: boolean): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, bone: boneName, condition } = transform;
			const bone = this.getBone(boneName);
			if (condition && !EvaluateCondition(condition, (c) => this.evalCondition(c))) {
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
