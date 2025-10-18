import type { Immutable } from 'immer';
import { AssertNever, EMPTY_ARRAY, type ItemRoomDevice, type RoomDeviceGraphicsLayerMesh, type RoomDeviceLayerImageOverride, type RoomDeviceLayerImageSetting } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator, useStandaloneConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { usePixiApplyMaskSource, type PixiMaskSource } from '../common/useApplyMask.ts';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { ContextCullClockwise, useItemColor, useLayerVertices, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMeshNormals } from './graphicsLayerMeshNormals.tsx';

export function GraphicsLayerMesh({
	characterState,
	layer,
	item,
	displayUvPose = false,
	state,
	debugConfig,
	characterBlinking,
}: GraphicsLayerProps<'mesh'>): ReactElement {

	const { points, triangles } = useLayerMeshPoints(layer);

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(characterState, currentlyBlinking);

	const {
		image,
		imageUv,
		normalMapImage,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, currentlyBlinking, imageUv);

	const { vertices, vertexRotations } = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator, points, layer, item, false);
	const uv = useLayerVertices(evaluatorUvPose, points, layer, item, true).vertices;

	const texture = useTexture(useImageResolutionAlternative(image).image);
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*');

	const { color, alpha } = useItemColor(characterState.items, item, layer.colorizationKey, state);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	return (
		layer.normalMap != null ? (
			<GraphicsLayerMeshNormals
				vertices={ vertices }
				vertexRotations={ vertexRotations }
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
}

export const GraphicsLayerRoomDeviceMesh = memo(function GraphicsLayerRoomDeviceMesh({
	item,
	layer,
	roomMask,
	getFilters,
}: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerMesh>;
	roomMask?: PixiMaskSource;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}): ReactElement {
	const evaluator = useStandaloneConditionEvaluator(item.assetManager);

	const { image, normalMapImage } = useMemo<Immutable<RoomDeviceLayerImageSetting> | Immutable<RoomDeviceLayerImageOverride>>(() => {
		return layer.image.overrides?.find((override) => EvaluateCondition(override.condition, (c) => evaluator.evalCondition(c, item))) ?? layer.image;
	}, [evaluator, item, layer]);

	const geometryData = useMemo(() => {
		if (layer.geometry.type === '2d') {
			if (layer.geometry.topology === 'triangle-list') {
				const vertices = Math.floor(layer.geometry.positions.length / 2);
				const result = {
					type: '2d',
					positions: new Float32Array(layer.geometry.positions),
					vertexRotations: new Float32Array(vertices),
					uvs: new Float32Array(layer.geometry.uvs),
					indices: new Uint32Array(layer.geometry.indices),
				} as const;

				const offset = layer.geometry.offsetOverrides?.find((o) => EvaluateCondition(o.condition, (c) => evaluator.evalCondition(c, item)))?.offset ?? layer.geometry.offset;
				const offsetX = offset?.x ?? 0;
				const offsetY = offset?.y ?? 0;
				for (let vi = 0; vi < vertices; vi++) {
					result.vertexRotations[vi] = 0;
					result.positions[2 * vi] += offsetX;
					result.positions[2 * vi + 1] += offsetY;
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

	if (geometryData.type === '2d') {
		return (
			layer.normalMap != null ? (
				<GraphicsLayerMeshNormals
					ref={ layer.clipToRoom ? applyRoomMask : null }
					vertices={ geometryData.positions }
					vertexRotations={ geometryData.vertexRotations }
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
