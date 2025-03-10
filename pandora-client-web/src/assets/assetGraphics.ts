import { Draft, Immutable, freeze, produce } from 'immer';
import {
	Assert,
	AssetGraphicsDefinition,
	AssetId,
	CharacterSize,
	LayerDefinition,
	LayerImageOverride,
	LayerImageSetting,
	LayerMirror,
	LayerPriority,
	MirrorBoneLike,
	MirrorImageOverride,
	MirrorLayerImageSetting,
} from 'pandora-common';
import { MirrorPriority } from '../graphics/def.ts';
import { Observable, ReadonlyObservable } from '../observable.ts';

export class AssetGraphicsLayer {
	public readonly asset: AssetGraphics;
	public mirror: AssetGraphicsLayer | undefined;
	public readonly isMirror: boolean;
	private _definition: Observable<Immutable<LayerDefinition>>;

	public get definition(): ReadonlyObservable<Immutable<LayerDefinition>> {
		return this._definition;
	}

	public get index(): number {
		return this.isMirror && this.mirror ? this.mirror.index : this.asset.layers.indexOf(this);
	}

	constructor(asset: AssetGraphics, definition: Immutable<LayerDefinition>, mirror?: AssetGraphicsLayer) {
		this.asset = asset;
		this._definition = new Observable(freeze(definition));
		this.mirror = mirror;
		this.isMirror = mirror !== undefined;
		if (!this.isMirror) {
			this._definition.subscribe(() => {
				this.updateMirror();
			}, true);
		}
	}

	private updateMirror(): void {
		if (this.isMirror)
			return;

		const definition = this._definition.value;

		if (definition.mirror === LayerMirror.NONE) {
			this.mirror = undefined;
			return;
		}

		const mirrored = produce(definition, (d) => {
			d.priority = MirrorPriority(d.priority);
			d.pointType = d.pointType?.map(MirrorBoneLike);
			d.image = MirrorLayerImageSetting(d.image);
			d.scaling = d.scaling && {
				...d.scaling,
				stops: d.scaling.stops.map((stop) => [stop[0], MirrorLayerImageSetting(stop[1])]),
			};

			if (d.mirror === LayerMirror.FULL) {
				d.x = CharacterSize.WIDTH - d.x;
			}
		});

		if (!this.mirror) {
			this.mirror = new AssetGraphicsLayer(this.asset, mirrored, this);
		} else {
			this.mirror._definition.value = mirrored;
		}
	}

	public _modifyDefinition(producer: (draft: Draft<Immutable<LayerDefinition>>) => void): void {
		Assert(!this.isMirror, 'Mirror definition cannot be edited');
		this._definition.value = produce(this._definition.value, producer);
	}

	private _modifyImageSettingsForScalingStop(stop: number | null | undefined, producer: (draft: Draft<Immutable<LayerImageSetting>>) => void): void {
		this._modifyDefinition((d) => {
			if (!stop) {
				producer(d.image);
				return;
			}
			const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
			if (!res) {
				throw new Error('Failed to get stop');
			}
			producer(res);
		});
	}

	public setPriority(priority: LayerPriority): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setPriority(MirrorPriority(priority));

		this._modifyDefinition((d) => {
			d.priority = priority;
		});
	}

	public setHeight(height: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setHeight(height);

		if (height > 0) {
			this._modifyDefinition((d) => {
				d.height = height;
			});
		}
	}

	public setWidth(width: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setWidth(width);

		if (width > 0) {
			this._modifyDefinition((d) => {
				d.width = width;
			});
		}
	}

	public setXOffset(offset: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setXOffset(offset);

		this._modifyDefinition((d) => {
			d.x = offset;
		});
	}

	public setYOffset(offset: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setYOffset(offset);

		this._modifyDefinition((d) => {
			d.y = offset;
		});
	}

	public setColorizationKey(colorizationKey: string | null): void {
		Assert(colorizationKey === null || colorizationKey.trim().length > 0, 'Colorization key must be null or non-empty');

		if (this.mirror && this.isMirror)
			return this.mirror.setColorizationKey(colorizationKey);

		this._modifyDefinition((d) => {
			d.colorizationKey = colorizationKey === null ? undefined : colorizationKey;
		});
	}

	public setPointType(pointType: string[]): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setPointType(pointType);

		this._modifyDefinition((d) => {
			d.pointType = pointType.length === 0 ? undefined : pointType.slice();
		});
	}

	public setImage(image: string, stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setImage(image, stop);

		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.image = image;
		});
	}

	public setImageOverrides(imageOverrides: LayerImageOverride[], stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setImageOverrides(imageOverrides.map(MirrorImageOverride), stop);

		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.overrides = imageOverrides.slice();
		});
	}

	public setAlphaImage(image: string, stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setAlphaImage(image, stop);

		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.alphaImage = image || undefined;
		});
	}

	public setAlphaOverrides(imageOverrides: LayerImageOverride[], stop?: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setAlphaOverrides(imageOverrides.map(MirrorImageOverride), stop);

		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.alphaOverrides = imageOverrides.length > 0 ? imageOverrides.slice() : undefined;
		});
	}

	public setName(name: string | undefined): void {
		if (this.mirror && this.isMirror)
			return this.mirror.setName(name);

		this._modifyDefinition((d) => {
			d.name = name;
		});
	}
}

export class AssetGraphics {
	public readonly id: AssetId;
	public layers!: readonly AssetGraphicsLayer[];

	public get allLayers(): AssetGraphicsLayer[] {
		return this.layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]);
	}

	constructor(id: AssetId, definition: Immutable<AssetGraphicsDefinition>) {
		this.id = id;
		this.load(definition);
	}

	public load(definition: Immutable<AssetGraphicsDefinition>) {
		this.layers = definition.layers.map(this.createLayer.bind(this));
	}

	public export(): Immutable<AssetGraphicsDefinition> {
		return {
			layers: this.layers.map((l) => l.definition.value),
		};
	}

	protected createLayer(definition: Immutable<LayerDefinition>): AssetGraphicsLayer {
		return new AssetGraphicsLayer(this, definition);
	}
}
