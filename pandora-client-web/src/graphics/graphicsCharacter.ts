import { AppearanceChangeType, BoneName, BoneState, GetLogger, AssetId, LayerPriority, ArmsPose, AssertNever } from 'pandora-common';
import { LayerState, PRIORITY_ORDER_ARMS_BACK, PRIORITY_ORDER_ARMS_FRONT, PRIORITY_ORDER_REVERSE_PRIORITIES } from './def';
import { AtomicCondition, CharacterSize, CharacterView, Item, TransformDefinition } from 'pandora-common/dist/assets';
import { AbstractRenderer, Application, autoDetectRenderer, BLEND_MODES, CLEAR_MODES, COLOR_MASK_BITS, Container, defaultVertex, Filter, filters, FilterSystem, IDestroyOptions, IMaskTarget, ISpriteMaskTarget, MaskData, MASK_TYPES, Matrix, Renderer, RenderTexture, Sprite, SpriteMaskFilter, Texture, TextureMatrix } from 'pixi.js';
import { AppearanceContainer } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import _ from 'lodash';

const logger = GetLogger('GraphicsCharacter');

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;

export const FAKE_BONES: string[] = ['backView'];

export class GraphicsCharacter<ContainerType extends AppearanceContainer = AppearanceContainer> extends Container {
	protected graphicsGetter: GraphicsGetterFunction | undefined;
	readonly appearanceContainer: ContainerType;
	private _layers: LayerState[] = [];
	private _pose: Record<BoneName, number> = {};
	private _cleanupUpdate?: () => void;

	constructor(appearanceContainer: ContainerType) {
		super();

		this.pivot.x = CharacterSize.WIDTH / 2;
		this.position.x = this.pivot.x;

		this.sortableChildren = true;

		this.appearanceContainer = appearanceContainer;

		this._cleanupUpdate = this.appearanceContainer.on('appearanceUpdate', (changes) => this.update(changes));
	}

	override destroy(options?: boolean | IDestroyOptions): void {
		this._cleanupUpdate?.();
		this._cleanupUpdate = undefined;
		super.destroy(options);
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
					state: {
						color: (
							layer.definition.colorizationIndex != null &&
							layer.definition.colorizationIndex >= 0 &&
							layer.definition.colorizationIndex < item.color.length
						) ? Number.parseInt(item.color[layer.definition.colorizationIndex].slice(1), 16) : undefined,
					},
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

	protected sortLayers(states: LayerState[]): OrderedLayerState[] {
		const view = this.appearanceContainer.appearance.getView();
		const ordered = this.getSortOrder()
			.map((priority) => new OrderedLayerState({ priority, view, states }));

		if (view === CharacterView.BACK) {
			ordered.reverse();
		}

		return ordered;
	}

	protected createLayer(layer: AssetGraphicsLayer, item: Item | null): GraphicsLayer {
		return new GraphicsLayer(layer, this, item);
	}

	private _graphicsLayers = new Map<LayerState, GraphicsLayer>();
	private _maskedLayers: OrderedLayerGraphics[] = [];
	protected layerUpdate(bones: Set<string>): void {
		this._evalCache.clear();
		for (const [key, graphics] of this._graphicsLayers) {
			if (!this._layers.includes(key)) {
				this._graphicsLayers.delete(key);
				this.removeChild(graphics);
				graphics.destroy();
			}
		}

		const layers = this.sortLayers(this._layers.slice());
		this._updateMaskedLayers(layers, GetMaskGroups(layers), bones);

		this.sortChildren();
		const backView = this.appearanceContainer.appearance.getView() === CharacterView.BACK;
		this.scale.x = backView ? -1 : 1;
	}

	private _getLayer(layerState: LayerState, bones: ReadonlySet<string>, cached: boolean): GraphicsLayer {
		let graphics = cached ? this._graphicsLayers.get(layerState) : undefined;
		if (!graphics) {
			graphics = this.createLayer(layerState.layer, layerState.item);
			this._graphicsLayers.set(layerState, graphics);
			graphics.on('destroy', () => this._graphicsLayers.delete(layerState));
			graphics.update({ state: layerState.state, force: true });
		} else {
			graphics.update({ state: layerState.state, bones });
		}
		return graphics;
	}

	private _updateMaskedLayers(layers: OrderedLayerState[], maskGroups: LayerPriority[][], bones: Set<string>): void {
		const destroy = _.remove(this._maskedLayers, (masked) => !maskGroups.some((group) => _.isEqual(group, masked.group)));
		destroy.forEach((d) => d.detach());
		maskGroups.forEach((group, index) => {
			let masked = this._maskedLayers.find((m) => _.isEqual(group, m.group));
			if (!masked) {
				masked = new OrderedLayerGraphics(group, this._getLayer.bind(this));
				this._maskedLayers.push(masked);
				this.addChild(masked);
			}
			masked.update(layers, bones);
			masked.zIndex = index + 1;
		});
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

class OrderedLayerState {
	public readonly states: readonly LayerState[];
	public readonly masks: readonly LayerState[];
	public readonly priority: LayerPriority;

	constructor({ priority, view, states }: { priority: LayerPriority, view: CharacterView, states: LayerState[]; }) {
		const all = states.filter((state) => state.layer.definition.priority === priority);
		let reverse = view === CharacterView.BACK;
		if (PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority)) {
			reverse = !reverse;
		}
		if (reverse) {
			all.reverse();
		}
		this.masks = _.remove(all, (state) => state.layer.definition.alphaMask !== undefined);
		this.priority = priority;
		this.states = all;
	}
}

class MaskFiler extends Filter {
	private readonly _maskSprite: IMaskTarget;
	private readonly _maskMatrix = new Matrix();

	constructor(mask: IMaskTarget) {
		super(`
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 otherMatrix;

varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

void main(void)
{
	gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

	vTextureCoord = aTextureCoord;
	vMaskCoord = ( otherMatrix * vec3( aTextureCoord, 1.0)  ).xy;
}
`, `
varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D mask;

void main(void)
{
	vec4 original = texture2D(uSampler, vTextureCoord);
	vec4 masky = texture2D(mask, vMaskCoord);
	if (masky.r < 0.5) {
		discard;
	} else {
		gl_FragColor = original;
	}
}
`);
		this._maskSprite = mask;
		this._maskSprite.renderable = false;
	}

	override apply(filterManager: FilterSystem, input: RenderTexture, output: RenderTexture, clearMode: CLEAR_MODES): void {
		const maskSprite = this._maskSprite as ISpriteMaskTarget;
		const tex = maskSprite._texture;

		if (!tex.valid) {
			return;
		}
		if (!tex.uvMatrix) {
			// margin = 0.0, let it bleed a bit, shader code becomes easier
			// assuming that atlas textures were made with 1-pixel padding
			tex.uvMatrix = new TextureMatrix(tex, 0.0);
		}
		tex.uvMatrix.update();

		this.uniforms.mask = tex;
		// get _normalized sprite texture coords_ and convert them to _normalized atlas texture coords_ with `prepend`
		this.uniforms.otherMatrix = filterManager.calculateSpriteMatrix(this._maskMatrix, maskSprite)
			.prepend(tex.uvMatrix.mapCoord);

		filterManager.applyFilter(this, input, output, clearMode);
	}
}

class OrderedLayerGraphics extends Container {
	private readonly _getLayer: (state: LayerState, bones: ReadonlySet<string>, cached: boolean) => GraphicsLayer;
	private _nextZIndex = 0;
	private _hasMasks = false;
	private readonly _maskLayers = new Container();
	private readonly _maskTexture = RenderTexture.create({ width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT });
	private readonly _maskSprite = new Sprite(this._maskTexture);
	// private readonly _maskFilter = new MaskFiler(this._maskSprite);
	public readonly group: LayerPriority[];

	static _app?: Application;
	static get renderer(): AbstractRenderer {
		if (!OrderedLayerGraphics._app) {
			OrderedLayerGraphics._app = new Application({
				backgroundAlpha: 0,
				resolution: 1,
				antialias: true,
				width: CharacterSize.WIDTH,
				height: CharacterSize.HEIGHT,
			});
		}
		return OrderedLayerGraphics._app.renderer;
	}

	public get priority(): LayerPriority {
		return this.group[0];
	}

	constructor(group: LayerPriority[], getLayer: (state: LayerState, bones: ReadonlySet<string>, cached: boolean) => GraphicsLayer) {
		super();
		this.sortableChildren = true;
		this._maskLayers.sortableChildren = true;
		this._getLayer = getLayer;
		this.group = group;
		this._maskSprite.width = CharacterSize.WIDTH;
		this._maskSprite.height = CharacterSize.HEIGHT;

		const sprite = new Sprite(Texture.WHITE);
		sprite.width = CharacterSize.WIDTH;
		sprite.height = CharacterSize.HEIGHT;
		sprite.zIndex = -1;

		this._maskLayers.addChild(sprite);

		// HERE: we actually draw the result sprite instead of using it as a filter (should have the same effect as adding sprite directly but noooooooo)
		this.addChild(this._maskSprite);
	}

	public detach() {
		this._maskLayers.destroy();
		this.removeChildren();
		this.parent?.removeChild(this);
		this.destroy();
	}

	public update(orderedStates: OrderedLayerState[], bones: ReadonlySet<string>): OrderedLayerGraphics {
		this._nextZIndex = 0;
		this._hasMasks = false;
		for (const ordered of orderedStates) {
			if (this.group.includes(ordered.priority)) {
				this._updateLayer(ordered.states, bones);
			}
			for (const mask of ordered.masks) {
				if (mask.layer.definition.alphaMask?.some((name) => this.group.includes(name))) {
					this._updateMask(mask, bones);
				}
			}

		}
		this.sortChildren();
		// eslint-disable-next-line no-constant-condition
		if (this._hasMasks || true) {
			this._maskLayers.sortChildren();

			// HERE: this just to test if we put a white texture directly, this._maskLayers is the correct one
			const sprite = new Sprite(Texture.WHITE);
			sprite.width = CharacterSize.WIDTH;
			sprite.height = CharacterSize.HEIGHT;
			OrderedLayerGraphics.renderer.render(sprite, { renderTexture: this._maskTexture, clear: true });

			// HERE: if all correct this will just work, hopefully...
			// this.filters = [this._maskFilter];

		} else if (this.mask) {
			this.filters = null;
		}
		return this;
	}

	private _updateLayer(states: readonly LayerState[], bones: ReadonlySet<string>): void {
		for (const state of states) {
			const layer = this._getLayer(state, bones, true);
			layer.zIndex = this._nextZIndex++;
			if (layer.parent === this) {
				continue;
			}
			layer.parent?.removeChild(layer);
			this.addChild(layer);
		}
	}

	private _maskCache = new Map<LayerState, GraphicsLayer>();
	private _updateMask(state: LayerState, bones: ReadonlySet<string>): void {
		this._hasMasks = true;
		let layer = this._maskCache.get(state);
		if (!layer) {
			layer = this._getLayer(state, bones, false);
			this._maskCache.set(state, layer);
			layer.on('destroy', () => this._maskCache.delete(state));
		}
		layer.zIndex = this._nextZIndex++;
		if (layer.parent) {
			return;
		}
		this._maskLayers.addChild(layer);
	}
}

function GetMaskGroups(ordered: OrderedLayerState[]): LayerPriority[][] {
	const priorities = ordered
		.filter((o) => o.states.length > 0)
		.map((o) => o.priority);

	return ordered.reduce((groups, state) => {
		if (state.masks.length === 0) {
			return groups;
		}

		for (const mask of state.masks) {
			// TODO: make sure this is always sorted
			const alphaMask = [...mask.layer.definition.alphaMask as LayerPriority[]]
				.sort();

			groups = MergeMasks(groups, alphaMask);
		}

		return ReorderMaskGroups(groups, priorities);
	}, [[...priorities]]);
}

function MergeMasks(groups: LayerPriority[][], mask: LayerPriority[]): LayerPriority[][] {
	if (mask.length === 0) {
		return groups;
	}
	let index = groups.findIndex((group) => group[0] === mask[0]);
	if (index === -1) {
		index = groups.findIndex((g) => g.includes(mask[0]));
		if (index === -1) {
			return MergeMasks(groups, mask.slice(1));
		}
		const group = groups[index];
		const split = group.indexOf(mask[0]);
		groups.push(group.slice(0, split));
		groups.push(group.slice(split));
		groups.splice(index, 1);
		if (groups[groups.length - 1][0] !== mask[0]) {
			throw new Error(`Mask group not found: ${mask[0]}`);
		}
		index = groups.length - 1;
	}
	const current = groups[index];
	for (let i = 1; i < mask.length; i++) {
		if (current.length <= i) {
			return MergeMasks(groups, mask.slice(i));
		}
		if (current[i] === mask[i]) {
			continue;
		}
		groups.splice(index, 1);
		groups.push(current.slice(0, i));
		groups.push(current.slice(i));
		return MergeMasks(groups, mask.slice(i));
	}
	if (current.length <= mask.length) {
		return groups;
	}
	groups.push(current.slice(0, mask.length));
	groups.push(current.slice(mask.length));
	groups.splice(index, 1);
	return groups;
}

function ReorderMaskGroups(groups: LayerPriority[][], order: LayerPriority[]): LayerPriority[][] {
	groups.map((group) => group.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
	groups.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
	return groups;
}
