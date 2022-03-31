import type { PointDefinition, LayerDefinition, LayerPriority, LayerImageOverride } from 'pandora-common/dist/character/asset/definition';
import { ObservableSet } from '../../../observable';

export const AllLayers: ObservableLayer[] = [];

export class ObservableLayer extends ObservableSet<{ points: PointDefinition[]; selected: boolean }> implements LayerDefinition {
	private readonly _layer: LayerDefinition;
	private _selected: boolean = false;

	constructor(layer: LayerDefinition) {
		super();
		this._layer = layer;
		AllLayers.push(this);
	}

	dispatchPointUpdate() {
		this.dispatch('points', this._layer.points);
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

	get selected(): boolean {
		return this._selected;
	}
	set selected(value: boolean) {
		if (this._selected !== value) {
			this._selected = value;
			this.dispatch('selected', value);
		}
	}
}
