import type { Immutable } from 'immer';
import {
	DualQuaternion,
	EMPTY_ARRAY,
	MAX_BONE_COUNT,
	type Coordinates,
	type Item,
	type RoomDeviceGraphicsLayerSprite,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { memo, useContext, useMemo, type ReactElement } from 'react';
import { useImageResolutionAlternative } from '../../assets/assetGraphicsCalculations.ts';
import { useStandaloneConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { usePixiApplyMaskSource, type PixiMaskSource } from '../common/useApplyMask.ts';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { ContextCullClockwise, useItemColor, type LayerVerticesTransformData } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMeshNormals } from './graphicsLayerMeshNormals.tsx';

export const GraphicsLayerRoomDeviceSprite = memo(function GraphicsLayerRoomDeviceSprite({ item, layer, roomMask, getFilters }: {
	item: Item;
	layer: Immutable<RoomDeviceGraphicsLayerSprite>;
	roomMask?: PixiMaskSource;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}): ReactElement | null {

	const evaluator = useStandaloneConditionEvaluator();

	const { image, normalMapImage } = useMemo(() => {
		return layer.imageOverrides?.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item))) ?? layer;
	}, [evaluator, item, layer]);

	const offset = useMemo((): Coordinates => {
		return layer.offsetOverrides?.find((o) => EvaluateCondition(o.condition, (c) => evaluator.evalCondition(c, item)))?.offset ??
			{ x: layer.x, y: layer.y };
	}, [evaluator, item, layer]);

	const texture = useTexture(useImageResolutionAlternative(image).image, undefined);
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*');

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

	const geometryData = useMemo(() => {
		const { width, height } = layer;

		const vertexTransformData: LayerVerticesTransformData = {
			vertices: new Float32Array([
				0, 0,
				width, 0,
				0, height,
				width, height,
			]),
			vertexSkinningBoneIndices: new Uint16Array(new Array(4 * 4).fill(0)),
			vertexSkinningBoneWeights: new Float32Array(new Array(4 * 4).fill(0)),
			boneTransforms: new Float32Array(8 * MAX_BONE_COUNT),
		};

		new DualQuaternion(1, 0, 0, 0, 0, 0, 0, 0).toArray(vertexTransformData.boneTransforms);
		for (let i = 8; i < 8 * MAX_BONE_COUNT; i++) {
			vertexTransformData.boneTransforms[i] = 0;
		}

		const result = {
			positions: vertexTransformData.vertices,
			vertexTransformData,
			uvs: new Float32Array([
				0, 0,
				1, 0,
				0, 1,
				1, 1,
			]),
			indices: new Uint32Array([
				3, 1, 0,
				0, 2, 3,
			]),
		} as const;

		return result;
	}, [layer]);

	if (layer.enableCond != null && !EvaluateCondition(layer.enableCond, (c) => evaluator.evalCondition(c, item)))
		return null;

	return (
		layer.normalMap != null ? (
			<GraphicsLayerMeshNormals
				ref={ layer.clipToRoom ? applyRoomMask : null }
				x={ offset.x }
				y={ offset.y }
				state={ cullingState }
				vertices={ geometryData.vertexTransformData }
				uvs={ geometryData.uvs }
				triangles={ geometryData.indices }
				texture={ texture }
				normalMapTexture={ normalMapTexture }
				normalMapData={ layer.normalMap }
				color={ color }
				alpha={ alpha }
				filters={ actualFilters }
			/>
		) : (
			<PixiMesh
				ref={ layer.clipToRoom ? applyRoomMask : null }
				x={ offset.x }
				y={ offset.y }
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
});
