import { CoordinatesCompressed, LayerDefinition, LayerMirror, LayerSide, PointDefinition, AssetState, LayerStateCompressed } from 'pandora-common/dist/assets';
import type { GraphicsTransform, GraphicsEvaluate } from './def';
import { Container, Mesh, MeshGeometry, MeshMaterial, Sprite, Texture } from 'pixi.js';
import { GraphicsCharacter } from './graphicsCharacter';
import { Conjunction, EvaluateCondition } from './utility';
import Delaunator from 'delaunator';
import { GetTextureLoader } from './textureLoader';

Mesh.BATCHABLE_SIZE = 1000000;

export type GraphicsLayerProps = {
	layer: LayerDefinition;
	state?: LayerStateCompressed;
	transform: GraphicsTransform,
	evaluate: GraphicsEvaluate;
	character: GraphicsCharacter;
};
export class GraphicsLayer extends Container {
	protected readonly layer: LayerDefinition;
	private readonly _transform: GraphicsTransform;
	private readonly _evaluate: GraphicsEvaluate;
	private _bones = new Set<string>();
	private _imageBones = new Set<string>();
	private _triangles = new Uint32Array();
	private _uv!: Float64Array;
	private _texture: Texture = Texture.EMPTY;
	private _image!: string;
	private _result!: Mesh | Sprite;
	private _state?: LayerStateCompressed;

	protected points: PointDefinition[] = [];
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
	}

	protected constructor({ layer, state, transform, evaluate }: GraphicsLayerProps) {
		super();
		this.x = layer.x;
		this.y = layer.y;
		this.layer = layer;
		this._transform = transform;
		this._evaluate = evaluate;

		this._calculatePoints();

		this.update({ state, force: true });
	}

	public static create = (props: GraphicsLayerProps) => new GraphicsLayer(props);

	public static getState(data: AssetState, index: number): LayerState | undefined {
		const layer = GetLayerState(data.layers, index);
		if (!layer) {
			return undefined;
		}
		const state: LayerState = {};
		if (layer[0] !== undefined) {
			state.color = layer[0];
		}
		if (layer[1] !== undefined) {
			state.alpha = layer[1];
		}
		return state;
	}

	public update({ bones = new Set(), state, force }: { bones?: Set<string>, state?: LayerStateCompressed, force?: boolean; }): void {
		let update = false;
		if (Conjunction(this._bones, bones) || force) {
			update = this.calculateVertices();
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
	}

	protected updateState(state?: LayerStateCompressed): void {
		const [color = 0xffffff, alpha = 1] = state ?? [];
		if (color !== this._result.tint) {
			this._result.tint = color;
		}
		if (alpha !== this._result.alpha) {
			this._result.alpha = alpha;
		}
	}

	protected calculateTexture(): boolean {
		const image = this.layer.imageOverrides.find((img) => EvaluateCondition(img.condition, this._evaluate))?.image ?? this.layer.image;
		if (image !== this._image) {
			this._image = image;
			GetTextureLoader().loadTexture(image).then((texture) => {
				if (this._image === image) {
					this.result.texture = this._texture = texture;
				}
			}).catch(() => { /** NOOP */ });
			return true;
		}
		return false;
	}

	protected calculateTriangles() {
		this._uv = new Float64Array(this.points.flatMap((point) => ([
			point.pos[0] / this.layer.width,
			point.pos[1] / this.layer.height,
		])));
		const triangles: number[] = [];
		const delaunator = new Delaunator(this.points.flatMap((point) => point.pos));
		for (let i = 0; i < delaunator.triangles.length; i += 3) {
			triangles.push(...[0, 1, 2].map((tp) => delaunator.triangles[tp + i]));
		}
		this._triangles = new Uint32Array(triangles);
	}

	protected calculateVertices(): boolean {
		this.vertices = new Float64Array(this.points
			.flatMap((point) => this._transform(this.mirrorPoint(point.pos), point.transforms, point.mirror)));

		return true;
	}

	private _calculatePoints() {
		this.points = this.layer.points.filter((point) => SelectPoints(point, this.layer.pointType, this.layer.side));

		this._bones = new Set(this.points.flatMap((point) => point.transforms.map((trans) => trans.bone)));
		this._imageBones = new Set(this.layer.imageOverrides.flatMap((override) => override.condition).flat().map((condition) => condition.bone));

		this.calculateTriangles();
	}

	protected mirrorPoint([x, y]: CoordinatesCompressed): CoordinatesCompressed {
		if (this.layer.mirror !== LayerMirror.FULL)
			return [x, y];

		return [x - this.layer.width, y];
	}
}

function SelectPoints({ pointType }: PointDefinition, pointTypes?: string[], side?: LayerSide): boolean {
	if (!pointType || !pointTypes)
		return true;

	let flt: ((def: string, sel: string) => boolean);
	switch (side) {
		case LayerSide.LEFT:
			flt = (def: string, sel: string) => def === sel || def === `${sel}_l`;
			break;
		case LayerSide.RIGHT:
			flt = (def: string, sel: string) => def === sel || def === `${sel}_r`;
			break;
		default:
			flt = (def: string, sel: string) => def === sel || def === `${sel}_l` || def === `${sel}_r`;
			break;
	}

	return pointTypes.some((sel) => flt(pointType, sel));
}

type LayerState = {
	color?: number;
	alpha?: number;
	pointTypes?: Set<string>;
};

export function GetLayerState(layers: AssetState['layers'] | undefined, index: number): LayerStateCompressed | undefined {
	return layers && (layers[index.toString() as `${number}`] || layers.base);
}

export function SetLayerState(layers: AssetState['layers'] | undefined, index: number, state: LayerStateCompressed): AssetState['layers'] {
	return {
		...(layers || {}),
		[index.toString() as `${number}`]: state,
	};
}
