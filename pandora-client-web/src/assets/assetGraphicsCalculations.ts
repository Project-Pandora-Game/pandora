import Delaunator from 'delaunator';
import { Immutable } from 'immer';
import { maxBy, minBy } from 'lodash-es';
import {
	Assert,
	Asset,
	BitField,
	BoneName,
	CloneDeepMutable,
	Item,
	LayerDefinition,
	LayerImageSetting,
	LayerMirror,
	MakeMirroredPoints,
	MirrorPoint,
	PointDefinition,
	PointMatchesPointType,
	type PointDefinitionCalculated,
	type PointTemplate,
} from 'pandora-common';
import { createContext, useContext, useMemo } from 'react';
import { Base64ToArray } from '../crypto/helpers.ts';
import { AppearanceConditionEvaluator } from '../graphics/appearanceConditionEvaluator.ts';
import { GRAPHICS_TEXTURE_RESOLUTION_SCALE, useGraphicsSettings } from '../graphics/graphicsSettings.tsx';
import { EvaluateCondition } from '../graphics/utility.ts';
import { useNullableObservable, useObservable, type ReadonlyObservable } from '../observable.ts';
import { useAutomaticResolution } from '../services/screenResolution/screenResolution.ts';
import type { AnyAssetGraphicsLayer, AssetGraphics, AssetGraphicsLayer } from './assetGraphics.ts';
import { useAssetManager } from './assetManager.tsx';
import { GraphicsManagerInstance } from './graphicsManager.ts';

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

export function useLayerDefinition<TLayer extends LayerDefinition>(layer: AssetGraphicsLayer<TLayer>): Immutable<TLayer> {
	return useObservable(layer.definition);
}

/** Constant for the most common case, so caches can just use reference to this object. */
const SCALING_IMAGE_UV_EMPTY: Record<BoneName, number> = Object.freeze({});
export function useLayerImageSource<TLayer extends LayerDefinition>(evaluator: AppearanceConditionEvaluator, layer: AssetGraphicsLayer<TLayer>, item: Item | null): Immutable<{
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
		return [scalingBaseimage, SCALING_IMAGE_UV_EMPTY];
	}, [evaluator, scaling, scalingBaseimage]);

	return useMemo((): ReturnType<typeof useLayerImageSource> => {
		const resultSetting = setting.overrides.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item))) ?? setting;

		return {
			setting,
			image: resultSetting.image,
			imageUv: resultSetting.uvPose ? {
				...resultSetting.uvPose,
				...scalingUv,
			} : scalingUv,
		};
	}, [evaluator, item, setting, scalingUv]);
}

export function LayerToImmediateName<TLayer extends LayerDefinition>(layer: AssetGraphicsLayer<TLayer>): string {
	let name = layer.definition.value.name || `Layer #${layer.index + 1}`;
	if (layer.isMirror) {
		name += ' (mirror)';
	}
	return name;
}

export function useLayerName(layer: AnyAssetGraphicsLayer): string {
	const d = useObservable<Immutable<LayerDefinition>>(layer.definition);
	let name = d.name || `Layer #${layer.index + 1}`;
	if (layer.isMirror) {
		name += ' (mirror)';
	}
	return name;
}

const pointMirrorCache = new WeakMap<Immutable<PointDefinition[]>, Immutable<PointDefinition[]>>();
const calculatedPointsCache = new WeakMap<Immutable<PointDefinition[]>, Immutable<PointDefinitionCalculated[]>>();
export function CalculatePointDefinitionsFromTemplate(template: Immutable<PointTemplate>, mirrorPoints: boolean = false): Immutable<PointDefinitionCalculated[]> {
	let points: Immutable<PointDefinition[]> = template;

	if (mirrorPoints) {
		let newPoints: Immutable<PointDefinition[]> | undefined = pointMirrorCache.get(points);
		if (newPoints === undefined) {
			newPoints = points.map(MirrorPoint);
			pointMirrorCache.set(points, newPoints);
		}
		points = newPoints;
	}

	let result: Immutable<PointDefinitionCalculated[]> | undefined = calculatedPointsCache.get(points);
	if (result === undefined) {
		result = points
			.map((point, index): PointDefinitionCalculated => ({
				...CloneDeepMutable(point),
				index,
				isMirror: false,
			}))
			.flatMap(MakeMirroredPoints);
		calculatedPointsCache.set(points, result);
	}
	return result;
}

const delaunatorCache = new WeakMap<Immutable<PointDefinitionCalculated[]>, Delaunator<number[]>>();
export function CalculatePointsTriangles(points: Immutable<PointDefinitionCalculated[]>, pointFilter?: BitField): Uint32Array {
	const result: number[] = [];
	let delaunator: Delaunator<number[]> | undefined = delaunatorCache.get(points);
	if (delaunator === undefined) {
		delaunator = new Delaunator(points.flatMap((point) => point.pos));
		delaunatorCache.set(points, delaunator);
	}
	for (let i = 0; i < delaunator.triangles.length; i += 3) {
		const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
		if (pointFilter == null || t.every((tp) => pointFilter.get(tp))) {
			result.push(...t);
		}
	}
	return new Uint32Array(result);
}

export function useLayerMeshPoints<TLayer extends LayerDefinition>(layer: AssetGraphicsLayer<TLayer>): {
	readonly points: Immutable<PointDefinitionCalculated[]>;
	readonly triangles: Uint32Array;
} {
	// Note: The points should NOT be filtered before Delaunator step!
	// Doing so would cause body and arms not to have exactly matching triangles,
	// causing (most likely) overlap, which would result in clipping.
	// In some other cases this could lead to gaps or other visual artifacts
	// Any optimization of unused points needs to be done *after* triangles are calculated
	const { points, pointType, pointFilterMask, mirror } = useLayerDefinition(layer);

	const manager = useObservable(GraphicsManagerInstance);
	const templateOverrides = useNullableObservable(useContext(AssetGraphicsResolverOverrideContext)?.pointTemplates);

	return useMemo((): ReturnType<typeof useLayerMeshPoints> => {
		const p = templateOverrides?.get(points) ?? manager?.getTemplate(points);
		if (!p) {
			throw new Error(`Unknown template '${p}'`);
		}

		const calculatedPoints = CalculatePointDefinitionsFromTemplate(p, (layer.isMirror && mirror === LayerMirror.FULL));
		Assert(calculatedPoints.length < 65535, 'Points do not fit into indices');

		const pointsFilter = new BitField(calculatedPoints.length);
		for (let i = 0; i < calculatedPoints.length; i++) {
			pointsFilter.set(i, PointMatchesPointType(calculatedPoints[i], pointType));
		}

		// Point filter based on binary mask (generated by asset repo during optimizations)
		if (pointFilterMask != null) {
			const pointFilterMaskData = new BitField(Base64ToArray(pointFilterMask));
			for (let i = 0; i < calculatedPoints.length; i++) {
				if (!pointFilterMaskData.get(i)) {
					pointsFilter.set(i, false);
				}
			}
		}

		return {
			points: calculatedPoints,
			triangles: CalculatePointsTriangles(calculatedPoints, pointsFilter),
		};
	}, [layer, manager, templateOverrides, points, mirror, pointType, pointFilterMask]);
}

export function useLayerHasAlphaMasks(layer: AnyAssetGraphicsLayer): boolean {
	return layer.type === 'alphaImageMesh';
}

export function useLayerImageSettingsForScalingStop(layer: AnyAssetGraphicsLayer, stop: number | null | undefined): Immutable<LayerImageSetting> {
	const d = useObservable<Immutable<LayerDefinition>>(layer.definition);
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
