import { PointDefinition, LayerDefinition, LayerPriority, LayerImageOverride, LayerMirror, LayerSide, CharacterSize } from 'pandora-common';
import { MirrorCondition, MirrorPoint } from '../../../assets/assetManager';
import { observable, ObservableClass } from '../../../observable';

export const AllLayers: ObservableLayer[] = [];

export class ObservableLayer extends ObservableClass<{ points: PointDefinition[]; selected: boolean; open: boolean; x: number; y: number; }> implements LayerDefinition {
	private readonly _layer: LayerDefinition;
	private _mirror: ObservableLayer | undefined;
	private _side?: LayerSide;

	@observable
	public open: boolean = true;
	@observable
	public selected: boolean = false;
	@observable
	public x: number;
	@observable
	public y: number;

	public readonly mirror: LayerMirror;
	public get side(): LayerSide | undefined {
		return this._side;
	}
	public get pointType(): string[] | undefined {
		return this._layer.pointType;
	}

	constructor(layer: LayerDefinition) {
		super();
		this.mirror = layer.mirror;
		if (layer instanceof ObservableLayer) {
			this._layer = {
				...layer._layer,
				imageOverrides: layer.imageOverrides.map(({ image, condition }): LayerImageOverride => ({ image, condition: MirrorCondition(condition) })),
			};
			if (this.mirror === LayerMirror.FULL) {
				this.x = CharacterSize.WIDTH - layer.x;
				this._layer.points = this.points.map(MirrorPoint);
			} else {
				this.x = layer.x;
				layer._side = LayerSide.LEFT;
				this._side = LayerSide.RIGHT;
			}

			this.y = layer.y;
			this._mirror = layer;

			this.on('x', (value) => layer.x = this.mirror === LayerMirror.FULL ? CharacterSize.WIDTH - value : value);
			this.on('y', (value) => layer.y = value);
			layer.on('x', (value) => this.x = this.mirror === LayerMirror.FULL ? CharacterSize.WIDTH - value : value);
			layer.on('y', (value) => this.y = value);
		} else {
			this._layer = layer;
			this.x = layer.x;
			this.y = layer.y;
		}
		AllLayers.push(this);
	}

	dispatchPointUpdate() {
		if (this._mirror) {
			if (this.mirror === LayerMirror.FULL)
				this._mirror._layer.points = this.points.map(MirrorPoint);
			this._mirror.emit('points', this._mirror.points);
		}
		this.emit('points', this.points);
	}

	getMirrored(): ObservableLayer {
		return this._mirror ??= new ObservableLayer(this);
	}

	get width(): number {
		return this._layer.width;
	}
	get height(): number {
		return this._layer.height;
	}

	get image(): string {
		return this._layer.image;
	}
	get priority(): LayerPriority {
		return this._layer.priority;
	}
	get points(): PointDefinition[] {
		return this._layer.points;
	}
	get imageOverrides(): LayerImageOverride[] {
		return this._layer.imageOverrides;
	}
}
