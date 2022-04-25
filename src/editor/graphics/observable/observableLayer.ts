import type { PointDefinition, LayerDefinition, LayerPriority, LayerImageOverride } from 'pandora-common/dist/character/asset/definition';
import { observable, ObservableClass } from '../../../observable';

export const AllLayers: ObservableLayer[] = [];

export class ObservableLayer extends ObservableClass<{ points: PointDefinition[]; selected: boolean; }> implements LayerDefinition {
	private readonly _layer: LayerDefinition;

	@observable
	public selected: boolean = false;

	constructor(layer: LayerDefinition) {
		super();
		this._layer = layer;
		AllLayers.push(this);
	}

	dispatchPointUpdate() {
		this.emit('points', this._layer.points);
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
