import { Draft, Immutable, freeze, produce } from 'immer';
import { cloneDeep, maxBy, minBy } from 'lodash';
import { Assert, Asset, AssetGraphicsDefinition, AssetId, BoneName, CharacterSize, Item, LayerDefinition, LayerImageOverride, LayerImageSetting, LayerMirror, LayerPriority, PointDefinition } from 'pandora-common';
import { useMemo } from 'react';
import { AppearanceConditionEvaluator } from '../graphics/appearanceConditionEvaluator';
import { MirrorPriority } from '../graphics/def';
import { GRAPHICS_TEXTURE_RESOLUTION_SCALE, useGraphicsSettings } from '../graphics/graphicsSettings';
import { MakeMirroredPoints, MirrorBoneLike, MirrorImageOverride, MirrorLayerImageSetting, MirrorPoint } from '../graphics/mirroring';
import { EvaluateCondition } from '../graphics/utility';
import { Observable, ReadonlyObservable, useObservable } from '../observable';
import { useAssetManager } from './assetManager';
import { GraphicsManagerInstance } from './graphicsManager';
import { useAutomaticResolution } from '../services/screenResolution/screenResolution';

export interface PointDefinitionCalculated extends PointDefinition {
	index: number;
	mirrorPoint?: PointDefinitionCalculated;
	isMirror: boolean;
}

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

	public createNewPoint(x: number, y: number): void {
		if (this.mirror && this.isMirror)
			return this.mirror.createNewPoint(x, y);

		x = Math.round(x);
		y = Math.round(y);

		const definition = this._definition.value;
		const sourceLayer = typeof definition.points === 'number' ? this.asset.layers[definition.points] : this;

		sourceLayer._modifyDefinition((d) => {
			Assert(typeof d.points !== 'number', 'More than one jump in points reference');
			Assert(typeof d.points !== 'string', 'Cannot create new point in template');
			d.points.push({
				pos: [x, y],
				mirror: false,
				transforms: [],
			});
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

export function useGraphicsAsset(graphics: AssetGraphics): Asset {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(graphics.id);
	Assert(asset, 'Asset not found');
	return asset;
}

export function useLayerDefinition(layer: AssetGraphicsLayer): Immutable<LayerDefinition> {
	return useObservable(layer.definition);
}

export function useLayerImageSource(evaluator: AppearanceConditionEvaluator, layer: AssetGraphicsLayer, item: Item | null): Immutable<{
	setting: Immutable<LayerImageSetting>;
	image: string;
	imageUv: Record<BoneName, number>;
}> {
	const {
		image: scalingBaseimage,
		scaling,
	} = useLayerDefinition(layer);

	const [setting, scalingUv] = useMemo((): Immutable<[LayerImageSetting, scalingUv: Record<BoneName, number>]> => {
		if (scaling) {
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				const best = maxBy(scaling.stops.filter((stop) => stop[0] > 0 && stop[0] <= value), (stop) => stop[0]);
				if (best != null) {
					return [
						best[1],
						{ [scaling.scaleBone]: best[0] },
					];
				}
			} else if (value < 0) {
				const best = minBy(scaling.stops.filter((stop) => stop[0] < 0 && stop[0] >= value), (stop) => stop[0]);
				if (best != null) {
					return [
						best[1],
						{ [scaling.scaleBone]: best[0] },
					];
				}
			}
		}
		return [scalingBaseimage, {}];
	}, [evaluator, scaling, scalingBaseimage]);

	return useMemo((): ReturnType<typeof useLayerImageSource> => {
		const resultSetting = setting.overrides.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item))) ?? setting;

		return {
			setting,
			image: resultSetting.image,
			imageUv: {
				...resultSetting.uvPose,
				...scalingUv,
			},
		};
	}, [evaluator, item, setting, scalingUv]);
}

export function LayerToImmediateName(layer: AssetGraphicsLayer): string {
	let name = layer.definition.value.name || `Layer #${layer.index + 1}`;
	if (layer.isMirror) {
		name += ' (mirror)';
	}
	return name;
}

export function useLayerName(layer: AssetGraphicsLayer): string {
	const d = useLayerDefinition(layer);
	let name = d.name || `Layer #${layer.index + 1}`;
	if (layer.isMirror) {
		name += ' (mirror)';
	}
	return name;
}

export function CalculateImmediateLayerPointDefinition(layer: AssetGraphicsLayer): PointDefinitionCalculated[] {
	const d = layer.definition.value;
	const sourceLayer = typeof d.points === 'number' ? layer.asset.layers[d.points] : layer;
	let { points } = sourceLayer.definition.value;
	Assert(typeof points !== 'number', 'More than one jump in points reference');

	if (typeof points === 'string') {
		const template = GraphicsManagerInstance.value?.getTemplate(points);
		if (!template) {
			throw new Error(`Unknown template '${points}'`);
		}
		points = template;
	}

	if (layer.isMirror && d.mirror === LayerMirror.FULL) {
		points = points.map(MirrorPoint);
	}
	const calculatedPoints = points.map<PointDefinitionCalculated>((point, index) => ({
		...cloneDeep(point) as PointDefinition,
		pos: [...point.pos],
		index,
		isMirror: false,
	}));
	return calculatedPoints.flatMap(MakeMirroredPoints);
}

export function useLayerCalculatedPoints(layer: AssetGraphicsLayer): PointDefinitionCalculated[] {
	const d = useLayerDefinition(layer);
	const sourceLayer = typeof d.points === 'number' ? layer.asset.layers[d.points] : layer;
	const { points } = useLayerDefinition(sourceLayer);
	Assert(typeof points !== 'number', 'More than one jump in points reference');

	const manager = useObservable(GraphicsManagerInstance);

	return useMemo(() => {
		let p = points;
		if (typeof p === 'string') {
			const template = manager?.getTemplate(p);
			if (!template) {
				throw new Error(`Unknown template '${p}'`);
			}
			p = template;
		}

		if (layer.isMirror && d.mirror === LayerMirror.FULL) {
			p = p.map(MirrorPoint);
		}
		const calculatedPoints = p.map<PointDefinitionCalculated>((point, index) => ({
			...cloneDeep(point) as PointDefinition,
			pos: [...point.pos],
			index,
			isMirror: false,
		}));
		return calculatedPoints.flatMap(MakeMirroredPoints);
	}, [d, layer, manager, points]);
}

export function useLayerHasAlphaMasks(layer: AssetGraphicsLayer): boolean {
	const d = useLayerDefinition(layer);

	return [...d.scaling?.stops.map((s) => s[1]) ?? [], d.image]
		.some((i) => !!i.alphaImage || !!i.alphaOverrides);
}

export function useLayerImageSettingsForScalingStop(layer: AssetGraphicsLayer, stop: number | null | undefined): Immutable<LayerImageSetting> {
	const d = useLayerDefinition(layer);
	if (!stop)
		return d.image;

	const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
	if (!res) {
		throw new Error('Failed to get stop');
	}
	return res;
}

export function useImageResolutionAlternative(image: string): {
	image: string;
	resolution: number;
	scale: number;
} {
	const { textureResolution } = useGraphicsSettings();
	const automaticResolution = useAutomaticResolution();

	const finalTextureResolution = textureResolution === 'auto' ? automaticResolution : textureResolution;

	const EXTENSIONS = ['.png', '.jpg'];

	for (const ext of EXTENSIONS) {
		if (image.endsWith(ext)) {
			if (finalTextureResolution !== '1') {
				return {
					image: image.substring(0, image.length - ext.length) + `_r${finalTextureResolution}${ext}`,
					resolution: 1 / GRAPHICS_TEXTURE_RESOLUTION_SCALE[finalTextureResolution],
					scale: GRAPHICS_TEXTURE_RESOLUTION_SCALE[finalTextureResolution],
				};
			}
		}
	}

	return {
		image,
		resolution: 1,
		scale: 1,
	};
}
