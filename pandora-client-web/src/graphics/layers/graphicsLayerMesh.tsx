import type { Immutable } from 'immer';
import { AssertNever, DualQuaternion, EMPTY_ARRAY, MAX_BONE_COUNT, type Item, type RoomDeviceGraphicsLayerMesh, type RoomDeviceLayerImageOverride, type RoomDeviceLayerImageSetting } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, useStandaloneConditionEvaluator, type AppearanceConditionEvaluator, type StandaloneConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { PixiSkinnedMesh } from '../baseComponents/skinnedMesh.tsx';
import { usePixiApplyMaskSource, type PixiMaskSource } from '../common/useApplyMask.ts';
import { useGraphicsBonePalette } from '../graphicsBonePaletteContext.tsx';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { ContextCullClockwise, useItemColor, useLayerVertices, useLayerVerticesTransformData, type GraphicsLayerProps, type LayerVerticesTransformData } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMeshNormals, type GraphicsLayerMeshNormalsProps } from './graphicsLayerMeshNormals.tsx';

export const GraphicsLayerMesh = memo(function GraphicsLayerMeshImpl(props: GraphicsLayerProps<'mesh'>): ReactElement | null {
	const currentlyBlinking = useNullableObservable(props.characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(props.poseEvaluator, props.wornItems, currentlyBlinking);
	if (props.layer.enableCond != null && !EvaluateCondition(props.layer.enableCond, (c) => evaluator.evalCondition(c, props.item)))
		return null;
	return <GraphicsLayerMeshEnabled { ...props } evaluator={ evaluator } />;
});

const GraphicsLayerMeshEnabled = memo(function GraphicsLayerMeshEnabledImpl({
	layer,
	item,
	wornItems,
	displayUvPose = false,
	state,
	debugConfig,
	evaluator,
}: GraphicsLayerProps<'mesh'> & { evaluator: AppearanceConditionEvaluator; }): ReactElement {
	const { points, triangles } = useLayerMeshPoints(layer);

	const {
		image,
		imageUvPose,
		normalMapImage,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useCharacterPoseEvaluator(evaluator.poseEvaluator.assetManager, imageUvPose);

	const vertexEvaluator = displayUvPose ? evaluatorUvPose : evaluator.poseEvaluator;
	const bonePalette = useGraphicsBonePalette(vertexEvaluator);
	const verticesData = useLayerVerticesTransformData(vertexEvaluator, points, layer, false);
	const uv = useLayerVertices(evaluatorUvPose, points, layer, true).vertices;

	const texture = useTexture(useImageResolutionAlternative(image).image);

	const { color, alpha } = useItemColor(wornItems, item, layer.colorizationKey, state);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	return (
		layer.normalMap != null ? (
			<GraphicsLayerMeshNormalsWithTexture
				bonePalette={ bonePalette }
				vertices={ verticesData }
				uvs={ uv }
				triangles={ triangles }
				texture={ texture }
				normalMapImage={ normalMapImage }
				normalMapData={ layer.normalMap }
				state={ cullingState }
				color={ color }
				alpha={ alpha }
				debugConfig={ debugConfig }
			/>
		) : (
			<PixiSkinnedMesh
				bonePalette={ bonePalette }
				state={ cullingState }
				vertices={ verticesData }
				uvs={ uv }
				indices={ triangles }
				texture={ texture }
				tint={ color }
				alpha={ alpha }
			/>
		)
	);
});

function GraphicsLayerMeshNormalsWithTexture({ normalMapImage, ...props }: Omit<GraphicsLayerMeshNormalsProps, 'normalMapTexture'> & { normalMapImage: string | undefined; }): ReactElement {
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*');
	return <GraphicsLayerMeshNormals { ...props } normalMapTexture={ normalMapTexture } />;
}

interface GraphicsLayerRoomDeviceMeshProps {
	item: Item;
	layer: Immutable<RoomDeviceGraphicsLayerMesh>;
	roomMask?: PixiMaskSource;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}

export const GraphicsLayerRoomDeviceMesh = memo(function GraphicsLayerRoomDeviceMeshImpl(props: GraphicsLayerRoomDeviceMeshProps): ReactElement | null {
	const evaluator = useStandaloneConditionEvaluator();
	if (props.layer.enableCond != null && !EvaluateCondition(props.layer.enableCond, (c) => evaluator.evalCondition(c, props.item)))
		return null;
	return <GraphicsLayerRoomDeviceMeshEnabled { ...props } evaluator={ evaluator } />;
});

const GraphicsLayerRoomDeviceMeshEnabled = memo(function GraphicsLayerRoomDeviceMeshEnabledImpl({
	item,
	layer,
	roomMask,
	getFilters,
	evaluator,
}: GraphicsLayerRoomDeviceMeshProps & { evaluator: StandaloneConditionEvaluator; }): ReactElement {

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

	if (geometryData.type === '2d') {
		return (
			layer.normalMap != null ? (
				<GraphicsLayerMeshNormalsWithTexture
					ref={ layer.clipToRoom ? applyRoomMask : null }
					vertices={ geometryData.vertexTransformData }
					uvs={ geometryData.uvs }
					triangles={ geometryData.indices }
					texture={ texture }
					normalMapImage={ normalMapImage }
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
