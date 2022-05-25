import { PointDefinition, LayerPriority, LayerImageOverride, LayerMirror, LayerSide, CharacterSize } from 'pandora-common';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { observable, ObservableClass } from '../../../observable';

export class ObservableLayer extends ObservableClass<{ points: PointDefinition[]; selected: boolean; open: boolean; x: number; y: number; }> {
	private readonly _layer: AssetGraphicsLayer;
	public readonly mirror: ObservableLayer | undefined;
	public readonly isMirror: boolean;
	private _side?: LayerSide;

	@observable
	public open: boolean = true;
	@observable
	public selected: boolean = false;
	@observable
	public x: number;
	@observable
	public y: number;

	public get side(): LayerSide | undefined {
		return this._side;
	}
	public get pointType(): string[] | undefined {
		return this._layer.definition.pointType;
	}

	constructor(layer: AssetGraphicsLayer, mirrorOf?: ObservableLayer) {
		super();
		this.isMirror = mirrorOf !== undefined;
		this._layer = layer;
		this.x = layer.definition.x;
		this.y = layer.definition.y;
		if (mirrorOf) {
			if (layer.definition.mirror === LayerMirror.FULL) {
				this.x = CharacterSize.WIDTH - mirrorOf.x;
				mirrorOf.on('x', (value) => this.x = CharacterSize.WIDTH - value);
			} else {
				this.x = mirrorOf.x;
				mirrorOf.on('x', (value) => this.x = value);
				mirrorOf._side = LayerSide.LEFT;
				this._side = LayerSide.RIGHT;
			}

			this.y = mirrorOf.y;
			mirrorOf.on('y', (value) => this.y = value);
			this.mirror = mirrorOf;
		}
		if (layer.mirror && !this.isMirror) {
			this.mirror = new ObservableLayer(layer.mirror, this);
		}
	}

	get width(): number {
		return this._layer.definition.width;
	}
	get height(): number {
		return this._layer.definition.height;
	}

	get image(): string {
		return this._layer.definition.image;
	}
	get priority(): LayerPriority {
		return this._layer.definition.priority;
	}
	get points(): PointDefinition[] {
		return this._layer.finalPoints;
	}
	get imageOverrides(): LayerImageOverride[] {
		return this._layer.definition.imageOverrides;
	}
}
