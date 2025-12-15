import type { Immutable } from 'immer';
import {
	AppearanceItems,
	Assert,
	AssertNever,
	DualQuaternion,
	HexColorString,
	Item,
	MAX_BONE_COUNT,
	Vector2,
	type GraphicsLayer,
	type GraphicsLayerType,
	type LayerStateOverrides,
	type PointDefinitionCalculated,
	type Rectangle,
	type WearableAssetType,
} from 'pandora-common';
import { ReactElement, createContext, useContext, useMemo } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useObservable, type ReadonlyObservable } from '../../observable.ts';
import type { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { type CharacterPoseEvaluator } from '../appearanceConditionEvaluator.ts';

type TransformEvalCacheEntryValue = WeakMap<Immutable<PointDefinitionCalculated[]>, LayerVerticesResult>;
const TransformEvalCache = new WeakMap<CharacterPoseEvaluator, TransformEvalCacheEntryValue>();

type TransformDataCacheEntryValue = WeakMap<Immutable<PointDefinitionCalculated[]>, LayerVerticesTransformData>;
const TransformDataCache = new WeakMap<CharacterPoseEvaluator, TransformDataCacheEntryValue>();

export type LayerVerticesResult = {
	vertices: Float32Array;
};

export type LayerVerticesTransformData = {
	vertices: Float32Array;
	vertexSkinningBoneIndices: Uint16Array;
	vertexSkinningBoneWeights: Float32Array;
	boneTransforms: Float32Array;
};

export function EvalLayerVerticesTransform(evaluator: CharacterPoseEvaluator, points: Immutable<PointDefinitionCalculated[]>): LayerVerticesResult {
	let cacheEntry: TransformEvalCacheEntryValue | undefined = TransformEvalCache.get(evaluator);
	if (cacheEntry === undefined) {
		cacheEntry = new WeakMap();
		TransformEvalCache.set(evaluator, cacheEntry);
	}

	let result: LayerVerticesResult | undefined = cacheEntry.get(points);
	if (result === undefined) {
		result = {
			vertices: new Float32Array(2 * points.length),
		};

		// Calculate vertices
		const tmpVec = new Vector2();
		for (let i = 0; i < points.length; i++) {
			const point = points[i];

			tmpVec.set(point.pos[0], point.pos[1]);
			if (point.skinning) {
				evaluator.skinPoint(
					tmpVec,
					point.skinning,
					point.transforms,
				);
			} else {
				evaluator.evalTransformVec(
					tmpVec,
					point.transforms,
				);
			}
			result.vertices[2 * i] = tmpVec.x;
			result.vertices[2 * i + 1] = tmpVec.y;
		}
		cacheEntry.set(points, result);
	}
	return result;
}

export function useLayerVertices(
	evaluator: CharacterPoseEvaluator,
	points: Immutable<PointDefinitionCalculated[]>,
	layerArea: Immutable<Rectangle>,
	normalize: boolean = false,
): LayerVerticesResult {
	return useMemo((): LayerVerticesResult => {
		// Eval transform
		const result = EvalLayerVerticesTransform(evaluator, points);

		// Normalize
		if (normalize) {
			const normalizedResult = new Float32Array(result.vertices.length);
			for (let i = 0; i < result.vertices.length; i++) {
				const odd = (i % 2) !== 0;
				normalizedResult[i] = (result.vertices[i] - (odd ? layerArea.y : layerArea.x)) /
					(odd ? layerArea.height : layerArea.width);
			}
			return {
				...result,
				vertices: normalizedResult,
			};
		}
		return result;
	}, [layerArea, evaluator, points, normalize]);
}

export function EvalLayerVerticesTransformData(evaluator: CharacterPoseEvaluator, points: Immutable<PointDefinitionCalculated[]>): LayerVerticesTransformData {
	let cacheEntry: TransformDataCacheEntryValue | undefined = TransformDataCache.get(evaluator);
	if (cacheEntry === undefined) {
		cacheEntry = new WeakMap();
		TransformDataCache.set(evaluator, cacheEntry);
	}

	let result: LayerVerticesTransformData | undefined = cacheEntry.get(points);
	if (result === undefined) {
		const bones = ['', ...evaluator.assetManager.getAllBones().map((b) => b.name)];
		result = {
			vertices: new Float32Array(2 * points.length),
			vertexSkinningBoneIndices: new Uint16Array(4 * points.length),
			vertexSkinningBoneWeights: new Float32Array(4 * points.length),
			boneTransforms: new Float32Array(8 * MAX_BONE_COUNT),
		};

		// Fill in bones
		const tmpQat = new DualQuaternion();
		for (let i = 0; i < bones.length; i++) {
			evaluator.getBoneTransformQuaterion(tmpQat, bones[i] || null);
			tmpQat.toArray(result.boneTransforms, 8 * i);
		}
		for (let i = 8 * bones.length; i < 8 * MAX_BONE_COUNT; i++) {
			result.boneTransforms[i] = 0;
		}

		// Calculate vertices
		const tmpVec = new Vector2();
		for (let i = 0; i < points.length; i++) {
			const point = points[i];

			tmpVec.set(point.pos[0], point.pos[1]);
			// We intentionall skip skinning here, leaving it to vertex shader
			evaluator.evalTransformVec(
				tmpVec,
				point.transforms,
			);

			result.vertices[2 * i] = tmpVec.x;
			result.vertices[2 * i + 1] = tmpVec.y;
			Assert(point.skinning === undefined || point.skinning.length <= 4);
			for (let si = 0; si < 4; si++) {
				const skinTargetIndex = 4 * i + si;
				if (point.skinning !== undefined && point.skinning.length > si) {
					const boneIndex = bones.indexOf(point.skinning[si].bone);
					Assert(boneIndex >= 0);
					result.vertexSkinningBoneIndices[skinTargetIndex] = boneIndex;
					result.vertexSkinningBoneWeights[skinTargetIndex] = point.skinning[si].weight;
				} else {
					result.vertexSkinningBoneIndices[skinTargetIndex] = 0;
					result.vertexSkinningBoneWeights[skinTargetIndex] = 0;
				}
			}
		}

		cacheEntry.set(points, result);
	}
	return result;
}

export function useLayerVerticesTransformData(
	evaluator: CharacterPoseEvaluator,
	points: Immutable<PointDefinitionCalculated[]>,
	layerArea: Immutable<Rectangle>,
	normalize: boolean = false,
): LayerVerticesTransformData {
	return useMemo((): LayerVerticesTransformData => {
		// Eval transform
		const result = EvalLayerVerticesTransformData(evaluator, points);

		// Normalize
		if (normalize) {
			const normalizedResult = new Float32Array(result.vertices.length);
			for (let i = 0; i < result.vertices.length; i++) {
				const odd = (i % 2) !== 0;
				normalizedResult[i] = (result.vertices[i] - (odd ? layerArea.y : layerArea.x)) /
					(odd ? layerArea.height : layerArea.width);
			}
			return {
				...result,
				vertices: normalizedResult,
			};
		}
		return result;
	}, [layerArea, evaluator, points, normalize]);
}

export interface GraphicsLayerProps<TLayerType extends GraphicsLayerType = GraphicsLayerType> {
	layer: Immutable<Extract<GraphicsLayer, { type: TLayerType; }>>;
	item: Item | null;

	/**
	 * Displays the vertices in pose matching the uv pose instead of the normal one.
	 * Useful for showing exact cutout of the original texture (which is useful in Editor).
	 * @default false
	 */
	displayUvPose?: boolean;
	state?: LayerStateOverrides;

	poseEvaluator: CharacterPoseEvaluator;
	wornItems: AppearanceItems<WearableAssetType>;
	/**
	 * Observable for whether the character the layer belongs to is currently mid-blink.
	 * If not passed, it is assumed to be `false`.
	 */
	characterBlinking?: ReadonlyObservable<boolean>;

	debugConfig?: Immutable<ChatroomDebugConfig>;
}

export const ContextCullClockwise = createContext<boolean>(false);

export function SwapCullingDirection({ children, swap = true }: ChildrenProps & { swap?: boolean; }): ReactElement {
	const cullClockwise = useContext(ContextCullClockwise);
	return (
		<ContextCullClockwise.Provider value={ swap ? !cullClockwise : cullClockwise }>
			{ children }
		</ContextCullClockwise.Provider>
	);
}

export function SwapCullingDirectionObservable({ children, swap }: ChildrenProps & { swap: ReadonlyObservable<boolean>; }): ReactElement {
	return (
		<SwapCullingDirection swap={ useObservable(swap) }>
			{ children }
		</SwapCullingDirection>
	);
}

export function useItemColorString(items: AppearanceItems, item: Item | null, colorizationKey?: string | null): HexColorString | undefined {
	if (item == null || colorizationKey == null) {
		return undefined;
	} else if (item.isType('bodypart')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('personal')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('roomDevice')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('roomDeviceWearablePart')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('lock')) {
		return undefined;
	}
	AssertNever(item);
}

export function useItemColor(items: AppearanceItems, item: Item | null, colorizationKey?: string | null, state?: LayerStateOverrides): { color: number; alpha: number; } {
	let color = 0xffffff;
	let alpha = 1;
	const itemColor = useItemColorString(items, item, colorizationKey);
	if (itemColor) {
		color = Number.parseInt(itemColor.substring(1, 7), 16);
		if (itemColor.length > 7) {
			alpha = Number.parseInt(itemColor.substring(7, 9), 16) / 255;
		}
	}
	if (state) {
		color = state.color ?? color;
		alpha = state.alpha ?? alpha;
	}
	return { color, alpha };
}

export function useItemColorRibbon(items: AppearanceItems, item: Item | null): HexColorString | undefined {
	let color: HexColorString | undefined;

	if (item == null) {
		color = undefined;
	} else if (item.isType('bodypart')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('personal')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('roomDevice')) {
		color = item.getColorRibbon();
	} else if (item.isType('roomDeviceWearablePart')) {
		color = item.getColorRibbon();
	} else if (item.isType('lock')) {
		color = undefined;
	} else {
		AssertNever(item);
	}

	return (color?.substring(0, 7) as HexColorString | undefined);
}
