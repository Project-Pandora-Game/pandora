import Delaunator from 'delaunator';
import { freeze, Immutable } from 'immer';
import { maxBy, minBy } from 'lodash';
import { Assert, Asset, BoneName, CloneDeepMutable, Item, LayerDefinition, LayerImageSetting, LayerMirror, PointDefinition, type PointTemplate } from 'pandora-common';
import { createContext, useContext, useMemo } from 'react';
import { AppearanceConditionEvaluator } from '../graphics/appearanceConditionEvaluator';
import { SelectPoints } from '../graphics/graphicsLayer';
import { GRAPHICS_TEXTURE_RESOLUTION_SCALE, useGraphicsSettings } from '../graphics/graphicsSettings';
import { MakeMirroredPoints, MirrorTemplate } from '../graphics/mirroring';
import { EvaluateCondition } from '../graphics/utility';
import { useNullableObservable, useObservable, type ReadonlyObservable } from '../observable';
import { useAutomaticResolution } from '../services/screenResolution/screenResolution';
import type { AssetGraphics, AssetGraphicsLayer, PointDefinitionCalculated } from './assetGraphics';
import { useAssetManager } from './assetManager';
import { GraphicsManagerInstance } from './graphicsManager';

export type AssetGraphicsResolverOverride = {
	pointTemplates?: ReadonlyObservable<ReadonlyMap<string, Immutable<PointTemplate>>>;
};

export const AssetGraphicsResolverOverrideContext = createContext<AssetGraphicsResolverOverride | null>(null);

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

const TEMPLATE_CALCULATION_CACHE = new WeakMap<Immutable<PointDefinition[]>, Immutable<PointDefinitionCalculated[]>>();
export function CalculatePointDefinitionsFromTemplate(template: Immutable<PointTemplate>, mirrorPoints: boolean = false): Immutable<PointDefinitionCalculated[]> {
	const points: Immutable<PointDefinition[]> = mirrorPoints ? MirrorTemplate(template) : template;

	const cache = TEMPLATE_CALCULATION_CACHE.get(points);
	if (cache) {
		return cache;
	}

	const calculatedPoints = points.map<PointDefinitionCalculated>((point, index) => ({
		...CloneDeepMutable(point),
		index,
		isMirror: false,
	}));
	const result = calculatedPoints.flatMap(MakeMirroredPoints);

	// Freeze source and result so cache is not broken
	freeze(points, true);
	freeze(result, true);
	TEMPLATE_CALCULATION_CACHE.set(points, result);

	return result;
}

export function CalculatePointsTriangles(points: Immutable<PointDefinitionCalculated[]>, pointType?: readonly string[]): Uint16Array {
	const result: number[] = [];
	const delaunator = new Delaunator(points.flatMap((point) => point.pos));
	for (let i = 0; i < delaunator.triangles.length; i += 3) {
		const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
		if (t.every((tp) => SelectPoints(points[tp], pointType))) {
			result.push(...t);
		}
	}
	return new Uint16Array(result);
}

export function useLayerCalculatedPoints(layer: AssetGraphicsLayer): Immutable<PointDefinitionCalculated[]> {
	const { points, mirror } = useLayerDefinition(layer);

	const manager = useObservable(GraphicsManagerInstance);
	const templateOverrides = useNullableObservable(useContext(AssetGraphicsResolverOverrideContext)?.pointTemplates);

	return useMemo((): Immutable<PointDefinitionCalculated[]> => {
		const p = templateOverrides?.get(points) ?? manager?.getTemplate(points);
		if (!p) {
			throw new Error(`Unknown template '${p}'`);
		}

		return CalculatePointDefinitionsFromTemplate(p, (layer.isMirror && mirror === LayerMirror.FULL));
	}, [layer, manager, templateOverrides, points, mirror]);
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
