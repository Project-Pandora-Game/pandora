import { AtomicConditionBone, BoneName, CoordinatesCompressed, Item, LayerMirror, PointDefinition } from 'pandora-common';
import type { LayerStateOverrides } from './def';
import { AbstractRenderer, Container, Mesh, MeshGeometry, MeshMaterial, Sprite, Texture } from 'pixi.js';
import { GraphicsCharacter } from './graphicsCharacter';
import { Conjunction, EvaluateCondition } from './utility';
import Delaunator from 'delaunator';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../assets/assetGraphics';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { max, maxBy, min, minBy } from 'lodash';
import { GraphicsMaskLayer } from './graphicsMaskLayer';

Mesh.BATCHABLE_SIZE = 1000000;

export class GraphicsLayer<Character extends GraphicsCharacter = GraphicsCharacter> extends Container {
	protected readonly character: Character;
	protected readonly item: Item | null;
	protected readonly layer: AssetGraphicsLayer;
	readonly renderer: AbstractRenderer;
	private _bones = new Set<string>();
	private _imageBones = new Set<string>();
	private _triangles = new Uint32Array();
	private _uv = new Float64Array();
	private _texture: Texture = Texture.EMPTY;
	private _image: string = '';
	private _result!: Mesh | Sprite;
	private _state?: LayerStateOverrides;
	private _alphaMask?: GraphicsMaskLayer;

	protected points: PointDefinitionCalculated[] = [];
	protected vertices = new Float64Array();

	protected get texture(): Texture {
		return this._texture;
	}
	protected get triangles(): Uint32Array {
		return this._triangles;
	}
	protected get uv(): Float64Array {
		return this._uv;
	}
	protected get result(): Mesh | Sprite {
		return this._result;
	}
	protected set result(value: Mesh | Sprite) {
		if (this._result) {
			this.removeChild(this._result);
			this._result.destroy();
		}
		this._result = value;
		this.addChild(this._result);
		if (this._alphaMask && value instanceof Sprite) {
			this._alphaMask.updateGeometry(undefined);
		}
	}

	public addLowerLayer(layer: Container): void {
		this.addChild(layer);
		this.sortChildren();
		if (this._alphaMask) {
			layer.filters = [this._alphaMask.filter];
		}
	}

	constructor(layer: AssetGraphicsLayer, character: Character, item: Item | null, renderer: AbstractRenderer) {
		super();
		this.sortableChildren = true;
		this.x = layer.definition.x;
		this.y = layer.definition.y;
		this.layer = layer;
		this.character = character;
		this.item = item;
		this.renderer = renderer;

		if (layer.hasAlphaMasks()) {
			this._alphaMask = new GraphicsMaskLayer(this.renderer, (image) => this.getTexture(image));
			this.addChild(this._alphaMask.sprite);
		}

		this._calculatePoints();
	}

	override destroy() {
		if (this._alphaMask) {
			this._alphaMask.destroy();
			this._alphaMask = undefined;
		}
		this.result.destroy();
		this._image = '';
		super.destroy({ children: false });
	}

	public update({ bones = new Set(), state, force }: { bones?: ReadonlySet<string>, state?: LayerStateOverrides, force?: boolean; }): void {
		let update = false;
		if (Conjunction(this._bones, bones) || force) {
			this.vertices = this.calculateVertices();

			const uvPose: Record<BoneName, number> = {};
			if (this.layer.definition.scaling) {
				let setting: number | undefined;
				const stops = this.layer.definition.scaling.stops.map((stop) => stop[0]);
				const value = this.character.getBoneLikeValue(this.layer.definition.scaling.scaleBone);
				// Find the best matching scaling override
				if (value > 0) {
					setting = max(stops.filter((stop) => stop > 0 && stop <= value));
				} else if (value < 0) {
					setting = min(stops.filter((stop) => stop < 0 && stop >= value));
				}
				if (setting) {
					uvPose[this.layer.definition.scaling.scaleBone] = setting;
				}
			}
			this._uv = this.calculateVertices(true, uvPose);

			update = true;
		}
		if (Conjunction(this._imageBones, bones) || force) {
			update = this.calculateTexture() || update;
		}
		if (update || force) {
			this.updateChild();
			this.updateState(state ?? this._state);
		} else if (state) {
			this.updateState(state);
		}
	}

	protected updateChild(): void {
		const geometry = new MeshGeometry(
			this.vertices,
			this._uv,
			this._triangles,
		);
		this.result = new Mesh(geometry, new MeshMaterial(this._texture));
		if (this._alphaMask) {
			this._alphaMask.updateGeometry(geometry);
		}
	}

	protected updateState(state?: LayerStateOverrides): void {
		this._state = state;

		const color: number = state?.color ??
			(
				(
					this.item != null &&
					this.layer.definition.colorizationIndex != null &&
					this.layer.definition.colorizationIndex >= 0 &&
					this.layer.definition.colorizationIndex < this.item.color.length
				) ? Number.parseInt(this.item.color[this.layer.definition.colorizationIndex].slice(1), 16) : undefined
			) ??
			0xffffff;

		const alpha = state?.alpha ?? 1;

		if (color !== this._result.tint) {
			this._result.tint = color;
		}
		if (alpha !== this._result.alpha) {
			this._result.alpha = alpha;
		}
	}

	protected calculateTexture(): boolean {
		const manager = GraphicsManagerInstance.value;
		if (!manager)
			return false;
		let setting = this.layer.definition.image;
		if (this.layer.definition.scaling) {
			const s = this.layer.definition.scaling;
			const value = this.character.getBoneLikeValue(s.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				setting = maxBy(s.stops.filter((stop) => stop[0] > 0 && stop[0] <= value), (stop) => stop[0])?.[1] ?? setting;
			} else if (value < 0) {
				setting = minBy(s.stops.filter((stop) => stop[0] < 0 && stop[0] >= value), (stop) => stop[0])?.[1] ?? setting;
			}
		}
		let change = false;

		const image = setting.overrides.find((img) => EvaluateCondition(img.condition, (c) => this.character.evalCondition(c, this.item)))?.image ?? setting.image;
		if (image !== this._image) {
			this._image = image;
			this.getTexture(image).then((texture) => {
				if (this._image === image && !this.destroyed) {
					this.result.texture = this._texture = texture;
				}
			}).catch(() => {
				if (!this.destroyed) {
					this.result.texture = this._texture = Texture.EMPTY;
				}
			});
			change = true;
		}
		if (this._alphaMask) {
			const alphaContent = setting.alphaOverrides?.find((img) => EvaluateCondition(img.condition, (c) => this.character.evalCondition(c, this.item)))?.image ?? setting.alphaImage ?? '';
			this._alphaMask.updateContent(alphaContent);
		}
		return change;
	}

	protected getTexture(image: string): Promise<Texture> {
		const manager = GraphicsManagerInstance.value;
		if (!manager)
			return Promise.reject();
		return manager.loader.getTexture(image);
	}

	protected _calculatePoints() {
		// Note: The points should NOT be filtered before Delaunator step!
		// Doing so would cause body and arms not to have exactly matching triangles,
		// causing (most likely) overlap, which would result in clipping.
		// In some other cases this could lead to gaps or other visual artifacts
		// Any optimization of unused points needs to be done *after* triangles are calculated
		this.points = this.layer.calculatePoints();

		this._bones = new Set(
			this.points
				.filter((point) => SelectPoints(point, this.layer.definition.pointType))
				.flatMap((point) => point.transforms.map((trans) => trans.bone)),
		);
		this._imageBones = new Set(
			(this.layer.definition.scaling?.stops.flatMap((stop) => stop[1]) ?? [])
				.concat([this.layer.definition.image])
				.flatMap((s) => s.overrides.concat(s.alphaOverrides ?? []))
				.flatMap((override) => override.condition)
				.flat()
				.filter((condition): condition is AtomicConditionBone => 'bone' in condition && condition.bone != null)
				.map((condition) => condition.bone)
				.concat(this.layer.definition.scaling ? [this.layer.definition.scaling.scaleBone] : []),
		);

		const triangles: number[] = [];
		const delaunator = new Delaunator(this.points.flatMap((point) => point.pos));
		for (let i = 0; i < delaunator.triangles.length; i += 3) {
			const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
			if (t.every((tp) => SelectPoints(this.points[tp], this.layer.definition.pointType))) {
				triangles.push(...t);
			}
		}
		this._triangles = new Uint32Array(triangles);
	}

	protected calculateVertices(normalize: boolean = false, valueOverrides?: Record<BoneName, number>): Float64Array {
		const result = new Float64Array(this.points
			.flatMap((point) => this.character.evalTransform(this.mirrorPoint(point.pos), point.transforms, point.mirror, this.item, valueOverrides)));
		if (normalize) {
			const h = this.layer.definition.height;
			const w = this.layer.definition.width;
			for (let i = 0; i < result.length; i++) {
				result[i] /= i % 2 ? h : w;
			}
		}
		return result;
	}

	protected mirrorPoint([x, y]: CoordinatesCompressed): CoordinatesCompressed {
		if (this.layer.definition.mirror === LayerMirror.FULL)
			return [x - this.layer.definition.width, y];

		return [x, y];
	}
}

export function SelectPoints({ pointType }: PointDefinition, pointTypes?: string[]): boolean {
	// If point has no type, include it
	return !pointType ||
		// If there is no requirement on point types, include all
		!pointTypes ||
		// If the point type is included exactly, include it
		pointTypes.includes(pointType) ||
		// If the point type doesn't have side, include it if wanted types have sided one
		!pointType.match(/_[lr]$/) && (
			pointTypes.includes(pointType + '_r') ||
			pointTypes.includes(pointType + '_l')
		) ||
		// If the point type has side, indide it if wanted types have base one
		pointTypes.includes(pointType.replace(/_[lr]$/, ''));
}
