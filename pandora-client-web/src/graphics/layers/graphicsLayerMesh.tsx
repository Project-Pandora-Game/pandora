import type { Immutable } from 'immer';
import { AssertNever, DualQuaternion, EMPTY_ARRAY, MAX_BONE_COUNT, type Item, type RoomDeviceGraphicsLayerMesh, type RoomDeviceLayerImageOverride, type RoomDeviceLayerImageSetting } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, useStandaloneConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { usePixiApplyMaskSource, type PixiMaskSource } from '../common/useApplyMask.ts';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { ContextCullClockwise, useItemColor, useLayerVertices, useLayerVerticesTransformData, type GraphicsLayerProps, type LayerVerticesTransformData } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMeshNormals } from './graphicsLayerMeshNormals.tsx';

export const GraphicsLayerMesh = memo(function GraphicsLayerMesh({
	layer,
	item,
	poseEvaluator,
	wornItems,
	displayUvPose = false,
	state,
	debugConfig,
	characterBlinking,
}: GraphicsLayerProps<'mesh'>): ReactElement | null {
	const { points, triangles } = useLayerMeshPoints(layer);

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(poseEvaluator, wornItems, currentlyBlinking);

	const {
		image,
		imageUvPose,
		normalMapImage,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useCharacterPoseEvaluator(poseEvaluator.assetManager, imageUvPose);

	const verticesData = useLayerVerticesTransformData(displayUvPose ? evaluatorUvPose : evaluator.poseEvaluator, points, layer, false);
	const vertices = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator.poseEvaluator, points, layer, false).vertices;
	const uv = useLayerVertices(evaluatorUvPose, points, layer, true).vertices;

	const texture = useTexture(useImageResolutionAlternative(image).image);
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*');

	const { color, alpha } = useItemColor(wornItems, item, layer.colorizationKey, state);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	if (layer.enableCond != null && !EvaluateCondition(layer.enableCond, (c) => evaluator.evalCondition(c, item)))
		return null;

	return (
		layer.normalMap != null ? (
			<GraphicsLayerMeshNormals
				vertices={ verticesData }
				uvs={ uv }
				triangles={ triangles }
				texture={ texture }
				normalMapTexture={ normalMapTexture }
				normalMapData={ layer.normalMap }
				state={ cullingState }
				color={ color }
				alpha={ alpha }
				debugConfig={ debugConfig }
			/>
		) : (
			<PixiMesh
				state={ cullingState }
				vertices={ vertices }
				uvs={ uv }
				indices={ triangles }
				texture={ texture }
				tint={ color }
				alpha={ alpha }
			/>
		)
	);
});

export const GraphicsLayerRoomDeviceMesh = memo(function GraphicsLayerRoomDeviceMesh({
	item,
	layer,
	roomMask,
	getFilters,
}: {
	item: Item;
	layer: Immutable<RoomDeviceGraphicsLayerMesh>;
	roomMask?: PixiMaskSource;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}): ReactElement | null {
	const evaluator = useStandaloneConditionEvaluator();

	const { image, normalMapImage } = useMemo<Immutable<RoomDeviceLayerImageSetting> | Immutable<RoomDeviceLayerImageOverride>>(() => {
		return layer.image.overrides?.find((override) => EvaluateCondition(override.condition, (c) => evaluator.evalCondition(c, item))) ?? layer.image;
	}, [evaluator, item, layer]);

	const geometryData = useMemo(() => {
		if (layer.geometry.type === '2d') {
			if (layer.geometry.topology === 'triangle-list') {
				const vertices = Math.floor(layer.geometry.positions.length / 2);
				const vertexTransformData: LayerVerticesTransformData = {
					vertices: new Float32Array(layer.geometry.positions),
					vertexSkinningBoneIndices: new Uint16Array(4 * vertices),
					vertexSkinningBoneWeights: new Float32Array(4 * vertices),
					boneTransforms: new Float32Array(8 * MAX_BONE_COUNT),
				};
				const result = {
					type: '2d',
					positions: vertexTransformData.vertices,
					vertexTransformData,
					vertexRotations: new Float32Array(vertices),
					uvs: new Float32Array(layer.geometry.uvs),
					indices: new Uint32Array(layer.geometry.indices),
				} as const;

				new DualQuaternion(1, 0, 0, 0, 0, 0, 0, 0).toArray(vertexTransformData.boneTransforms);
				for (let i = 80; i < 8 * MAX_BONE_COUNT; i++) {
					vertexTransformData.boneTransforms[i] = 0;
				}

				const offset = layer.geometry.offsetOverrides?.find((o) => EvaluateCondition(o.condition, (c) => evaluator.evalCondition(c, item)))?.offset ?? layer.geometry.offset;
				const offsetX = offset?.x ?? 0;
				const offsetY = offset?.y ?? 0;
				for (let vi = 0; vi < vertices; vi++) {
					result.vertexRotations[vi] = 0;
					result.positions[2 * vi] += offsetX;
					result.positions[2 * vi + 1] += offsetY;

					for (let si = 0; si < 4; si++) {
						const skinTargetIndex = 4 * vi + si;
						vertexTransformData.vertexSkinningBoneIndices[skinTargetIndex] = 0;
						vertexTransformData.vertexSkinningBoneWeights[skinTargetIndex] = 0;
					}
				}

				return result;
			}
			AssertNever(layer.geometry.topology);
		}
		AssertNever(layer.geometry.type);
	}, [evaluator, item, layer.geometry]);

	const { color, alpha } = useItemColor(EMPTY_ARRAY, item, layer.colorizationKey);

	const actualFilters = useMemo<PIXI.Filter[] | undefined>(() => getFilters()?.slice(), [getFilters]);

	const applyRoomMask = usePixiApplyMaskSource(roomMask ?? null);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	const texture = useTexture(useImageResolutionAlternative(image).image);
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*');

	if (layer.enableCond != null && !EvaluateCondition(layer.enableCond, (c) => evaluator.evalCondition(c, item)))
		return null;

	if (geometryData.type === '2d') {
		return (
			layer.normalMap != null ? (
				<GraphicsLayerMeshNormals
					ref={ layer.clipToRoom ? applyRoomMask : null }
					vertices={ geometryData.vertexTransformData }
					uvs={ geometryData.uvs }
					triangles={ geometryData.indices }
					texture={ texture }
					normalMapTexture={ normalMapTexture }
					normalMapData={ layer.normalMap }
					state={ cullingState }
					color={ color }
					alpha={ alpha }
					filters={ actualFilters }
				/>
			) : (
				<PixiMesh
					ref={ layer.clipToRoom ? applyRoomMask : null }
					state={ cullingState }
					vertices={ geometryData.positions }
					uvs={ geometryData.uvs }
					indices={ geometryData.indices }
					texture={ texture }
					tint={ color }
					alpha={ alpha }
					filters={ actualFilters }
				/>
			)
		);
	} else {
		AssertNever(geometryData.type);
	}
});
