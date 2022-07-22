import { AssetGraphicsDefinition, AssetId, CharacterSize, LayerDefinition, LayerImageOverride, LayerImageSetting, LayerMirror, LayerSide, PointDefinition } from 'pandora-common';
import { TypedEventEmitter } from '../event';
import { MakeMirroredPoints, MirrorImageOverride, MirrorLayerImageSetting, MirrorPoint } from '../graphics/mirroring';
import { GraphicsManagerInstance } from './graphicsManager';

export interface PointDefinitionCalculated extends PointDefinition {
	index: number;
	mirrorPoint?: PointDefinitionCalculated;
	isMirror: boolean;
}

export class AssetGraphicsLayer extends TypedEventEmitter<{
	change: undefined;
}> {
	public readonly asset: AssetGraphics;
	public mirror: AssetGraphicsLayer | undefined;
	public readonly isMirror: boolean;
	public definition: LayerDefinition;
	public side: LayerSide | undefined;

	public get index(): number {
		return this.isMirror && this.mirror ? this.mirror.index : this.asset.layers.indexOf(this);
	}

	public get name(): string {
		let name = this.definition.name || `${this.index}`;
		if (this.side === LayerSide.LEFT) {
			name += ' (left)';
		} else if (this.side === LayerSide.RIGHT) {
			name += ' (right)';
		} else if (this.isMirror) {
			name += ' (mirror)';
		}
		return name;
	}

	constructor(asset: AssetGraphics, definition: LayerDefinition, mirror?: AssetGraphicsLayer) {
		super();
		this.asset = asset;
		this.definition = definition;
		this.mirror = mirror;
		this.isMirror = mirror !== undefined;
		this.updateMirror();
	}

	public calculatePoints(): PointDefinitionCalculated[] {
		let points = this.definition.points;
		if (typeof points === 'number') {
			points = this.asset.layers[points].definition.points;
			if (!Array.isArray(points)) {
				throw new Error('More than one jump in points reference');
			}
		}
		if (typeof points === 'string') {
			const template = GraphicsManagerInstance.value?.getTemplate(points);
			if (!template) {
				throw new Error(`Unknown template '${points}'`);
			}
			points = template;
		}
		if (this.isMirror && this.definition.mirror === LayerMirror.FULL) {
			points = points.map(MirrorPoint);
		}
		const calculatedPoints = points.map<PointDefinitionCalculated>((point, index) => ({
			...point,
			index,
			isMirror: false,
		}));
		return calculatedPoints.flatMap(MakeMirroredPoints);
	}

	private updateMirror(): void {
		if (this.isMirror)
			return;

		if (this.definition.mirror === LayerMirror.NONE) {
			this.mirror = undefined;
			return;
		}

		const mirrored: LayerDefinition = {
			...this.definition,
			image: MirrorLayerImageSetting(this.definition.image),
			scaling: this.definition.scaling && {
				...this.definition.scaling,
				stops: this.definition.scaling.stops.map((stop) => [stop[0], MirrorLayerImageSetting(stop[1])]),
			},
		};

		if (this.definition.mirror === LayerMirror.FULL) {
			mirrored.x = CharacterSize.WIDTH - this.definition.x;
		}

		if (!this.mirror) {
			this.mirror = new AssetGraphicsLayer(this.asset, mirrored, this);
		} else {
			this.mirror.definition = mirrored;
		}

		if (this.definition.mirror === LayerMirror.SELECT) {
			this.side = LayerSide.LEFT;
			this.mirror.side = LayerSide.RIGHT;
		}
	}

	public getAllImages(): string[] {
		const result = new Set<string>();
		for (const setting of (this.definition.scaling?.stops.map((s) => s[1]) ?? []).concat(this.definition.image)) {
			result.add(setting.image);
			for (const override of setting.overrides) {
				result.add(override.image);
			}
		}
		result.delete('');
		return Array.from(result.values());
	}

	public setImage(image: string, stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setImage(image, stop);

		const setting = this.getImageSettingsForScalingStop(stop);
		setting.image = image;

		this.onChange();
	}

	public setPointType(pointType: string[]): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setPointType(pointType);

		this.definition.pointType = pointType.length === 0 ? undefined : pointType.slice();
		this.onChange();
	}

	public setImageOverrides(imageOverrides: LayerImageOverride[], stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setImageOverrides(imageOverrides.map(MirrorImageOverride), stop);

		const settings = this.getImageSettingsForScalingStop(stop);
		settings.overrides = imageOverrides.slice();

		this.onChange();
	}

	public onChange(): void {
		if (this.mirror && this.isMirror)
			return this.mirror.onChange();

		this.emit('change', undefined);
		if (this.mirror) {
			this.updateMirror();
			this.mirror.emit('change', undefined);
		}
		// Notify all layers that depend on this one
		if (!this.isMirror && Array.isArray(this.definition.points)) {
			const index = this.index;
			for (const layer of this.asset.layers) {
				if (layer !== this && layer.definition.points === index) {
					layer.onChange();
				}
			}
		}
	}

	public createNewPoint(x: number, y: number): void {
		x = Math.round(x);
		y = Math.round(y);

		let layer = this.mirror && this.isMirror ? this.mirror : this;
		if (typeof layer.definition.points === 'number') {
			layer = layer.asset.layers[layer.definition.points];
			if (!Array.isArray(layer.definition.points)) {
				throw new Error('More than one jump in points reference');
			}
		}
		if (typeof layer.definition.points === 'string') {
			throw new Error('Cannot create new point in template');
		}
		layer.definition.points.push({
			pos: [x, y],
			mirror: false,
			transforms: [],
		});
		layer.onChange();
	}

	public getImageSettingsForScalingStop(stop: number | null | undefined): LayerImageSetting {
		if (!stop)
			return this.definition.image;
		const res = this.definition.scaling?.stops.find((s) => s[0] === stop)?.[1];
		if (!res) {
			throw new Error('Failed to get stop');
		}
		return res;
	}
}

export class AssetGraphics {
	public readonly id: AssetId;
	public layers!: readonly AssetGraphicsLayer[];

	public get allLayers(): AssetGraphicsLayer[] {
		return this.layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]);
	}

	constructor(id: AssetId, definition: AssetGraphicsDefinition) {
		this.id = id;
		this.load(definition);
	}

	load(definition: AssetGraphicsDefinition) {
		this.layers = definition.layers.map(this.createLayer.bind(this));
	}

	export(): AssetGraphicsDefinition {
		return {
			layers: this.layers.map((l) => l.definition),
		};
	}

	protected createLayer(definition: LayerDefinition): AssetGraphicsLayer {
		return new AssetGraphicsLayer(this, definition);
	}

	public getAllImages(): string[] {
		const result = new Set<string>();
		for (const layer of this.layers) {
			for (const image of layer.getAllImages()) {
				result.add(image);
			}
		}
		result.delete('');
		return Array.from(result.values());
	}
}
