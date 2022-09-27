import { AppearanceChangeType, BoneName, BoneState, GetLogger, AssetId, LayerPriority, ArmsPose, AssertNever } from 'pandora-common';
import { LayerState, PRIORITY_ORDER_ARMS_BACK, PRIORITY_ORDER_ARMS_FRONT, PRIORITY_ORDER_REVERSE_PRIORITIES } from './def';
import { AtomicCondition, CharacterSize, CharacterView, Item, TransformDefinition } from 'pandora-common/dist/assets';
import { AbstractRenderer, Container } from 'pixi.js';
import { AppearanceContainer } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';

const logger = GetLogger('GraphicsCharacter');

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;

export const FAKE_BONES: string[] = ['backView'];

export class GraphicsCharacter<ContainerType extends AppearanceContainer = AppearanceContainer> extends Container {
	protected graphicsGetter: GraphicsGetterFunction | undefined;
	readonly appearanceContainer: ContainerType;
	readonly renderer: AbstractRenderer;
	private _layers: readonly LayerState[] = [];
	private _pose: Record<BoneName, number> = {};
	protected cleanupCalls: (() => void)[] = [];

	private displayContainer = new Container();

	private _graphicsLayers = new Map<LayerState, GraphicsLayer>();
	private _lastUpdateLayers: readonly LayerState[] | undefined;
	private _lastUpdateView: CharacterView | undefined;

	constructor(appearanceContainer: ContainerType, renderer: AbstractRenderer) {
		super();

		this.pivot.x = CharacterSize.WIDTH / 2;
		this.position.x = this.pivot.x;

		this.sortableChildren = true;

		this.addChild(this.displayContainer);

		this.appearanceContainer = appearanceContainer;
		this.renderer = renderer;

		this.cleanupCalls.push(
			this.appearanceContainer.on('appearanceUpdate', (changes) => this.update(changes)),
		);
	}

	override destroy(): void {
		// Run cleanup handlers
		this.cleanupCalls.reverse().forEach((c) => c());
		this.cleanupCalls = [];
		// Cleanup graphics layers
		for (const graphics of this._graphicsLayers.values()) {
			graphics.destroy();
		}
		this._graphicsLayers.clear();
		this._lastUpdateLayers = undefined;
		this._lastUpdateView = undefined;
		// Destroy the container itself
		super.destroy({ children: true });
	}

	public useGraphics(graphicsGetter: GraphicsGetterFunction): void {
		this.graphicsGetter = graphicsGetter;
		this.update(['items', 'pose']);
	}

	protected update(changes: AppearanceChangeType[]): void {
		if (changes.length === 0)
			return;
		if (changes.includes('items')) {
			this._layers = this.buildLayers();
		}
		const updatedBones = new Set<string>();
		if (changes.includes('pose')) {
			const newPose = this.appearanceContainer.appearance.getFullPose();
			for (const bone of newPose) {
				if (this._pose[bone.definition.name] !== bone.rotation) {
					updatedBones.add(bone.definition.name);
					this._pose[bone.definition.name] = bone.rotation;
				}
			}
			// Fake bones have more logic, so they can change anytime
			FAKE_BONES.forEach((b) => updatedBones.add(b));
		}
		this.layerUpdate(updatedBones);
	}

	protected buildLayers(): LayerState[] {
		if (!this.graphicsGetter)
			return [];
		const result: LayerState[] = [];
		for (const item of this.appearanceContainer.appearance.getAllItems()) {
			const graphics = this.graphicsGetter(item.asset.id);
			if (!graphics) {
				if (item.asset.definition.hasGraphics) {
					logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				}
				continue;
			}
			result.push(
				...graphics.allLayers.map<LayerState>((layer) => ({
					layer,
					item,
				})),
			);
		}
		return result;
	}

	public getSortOrder(): readonly LayerPriority[] {
		const armsPose = this.appearanceContainer.appearance.getArmsPose();
		if (armsPose === ArmsPose.FRONT) {
			return PRIORITY_ORDER_ARMS_FRONT;
		} else if (armsPose === ArmsPose.BACK) {
			return PRIORITY_ORDER_ARMS_BACK;
		}
		AssertNever(armsPose);
	}

	protected createLayer(layer: AssetGraphicsLayer, item: Item | null): GraphicsLayer {
		return new GraphicsLayer(layer, this, item, this.renderer);
	}

	protected layerUpdate(bones: Set<string>): void {
		this._evalCache.clear();
		for (const [key, graphics] of this._graphicsLayers) {
			if (!this._layers.includes(key)) {
				this._graphicsLayers.delete(key);
				graphics.destroy();
			}
		}
		const view = this.appearanceContainer.appearance.getView();

		if (this._layers === this._lastUpdateLayers && view === this._lastUpdateView) {
			this._layers.forEach((layerState) => {
				const graphics = this._graphicsLayers.get(layerState);
				if (!graphics) {
					throw new Error('Graphics not found while built layers didn\'t change');
				} else {
					graphics.update({ state: layerState.state, bones });
				}
			});
			return;
		}

		const priorityLayers = new Map<LayerPriority, GraphicsLayer>();
		this._layers.forEach((layerState) => {
			let graphics = this._graphicsLayers.get(layerState);
			if (!graphics) {
				graphics = this.createLayer(layerState.layer, layerState.item);
				this._graphicsLayers.set(layerState, graphics);
				graphics.update({ state: layerState.state, force: true });
			} else {
				graphics.update({ state: layerState.state, bones });
			}

			const priority = layerState.layer.definition.priority;
			const reverse = PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority) !== (view === CharacterView.BACK);

			const lowerLayer = priorityLayers.get(priority);

			if (lowerLayer) {
				lowerLayer.zIndex = reverse ? 1 : -1;
				graphics.addLowerLayer(lowerLayer);
			}

			priorityLayers.set(priority, graphics);
		});

		this.displayContainer.removeChildren();
		let sortOrder = this.getSortOrder();
		if (view === CharacterView.BACK) {
			sortOrder = sortOrder.slice().reverse();
		}
		sortOrder.forEach((priority) => {
			const layer = priorityLayers.get(priority);
			if (layer) {
				this.displayContainer.addChild(layer);
			}
		});

		this.sortChildren();
		const backView = view === CharacterView.BACK;
		this.scale.x = backView ? -1 : 1;
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: AtomicCondition, item: Item | null): boolean {
		if ('module' in condition && condition.module != null) {
			const m = item?.modules.get(condition.module);
			// If there is no item or no module, the value is always not equal
			if (!m) {
				return condition.operator === '!=';
			}
			return m.evalCondition(condition.operator, condition.value);
		}

		if ('bone' in condition && condition.bone != null) {
			const key = `${condition.bone}-${condition.operator}-${condition.value}`;
			let result = this._evalCache.get(key);
			if (result === undefined) {
				const value = this.getBoneLikeValue(condition.bone);
				this._evalCache.set(key, result = this._evalConditionCore(condition, value));
			}
			return result;
		}

		AssertNever();
	}
	private _evalConditionCore({ operator, value }: AtomicCondition, currentValue: number): boolean {
		switch (operator) {
			case '>':
				return currentValue > value;
			case '<':
				return currentValue < value;
			case '=':
				return currentValue === value;
			case '!=':
				return currentValue !== value;
			case '>=':
				return currentValue >= value;
			case '<=':
				return currentValue <= value;
		}
		AssertNever(operator);
	}

	public evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[], _mirror: boolean, item: Item | null, valueOverrides?: Record<BoneName, number>): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, bone: boneName, condition } = transform;
			const bone = this.getBone(boneName);
			const rotation = valueOverrides ? (valueOverrides[boneName] ?? 0) : bone.rotation;
			if (condition && !EvaluateCondition(condition, (c) => this.evalCondition(c, item))) {
				continue;
			}
			switch (type) {
				case 'rotate': {
					let vecX = resX - bone.definition.x;
					let vecY = resY - bone.definition.y;
					const value = transform.value * rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.definition.x + vecX;
					resY = bone.definition.y + vecY;
					break;
				}
				case 'shift': {
					const percent = rotation / 180;
					resX += percent * transform.value.x;
					resY += percent * transform.value.y;
					break;
				}
			}
		}
		return [resX, resY];
	}
	//#endregion

	public getBone(name: string): BoneState {
		return this.appearanceContainer.appearance.getPose(name);
	}

	public getBoneLikeValue(name: string): number {
		if (name === 'backView') {
			return this.appearanceContainer.appearance.getView() === CharacterView.BACK ? 1 : 0;
		}
		return this.getBone(name).rotation;
	}
}
