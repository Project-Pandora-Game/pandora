import type { Immutable } from 'immer';
import type { LayerNormalData } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo, type RefAttributes } from 'react';
import type { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { PixiCustomMesh, PixiCustomMeshGeometryCreator, type PixiCustomMeshProps, type PixiCustomMeshShaderCreator } from '../baseComponents/customMesh.tsx';
import type { GraphicsBonePalette } from '../graphicsBonePalette.ts';
import type { LayerVerticesTransformData } from './graphicsLayerCommon.tsx';
import { CreateOrUpdateNormalMeshShader } from './graphicsLayerMeshNormalsShader.ts';

export interface GraphicsLayerMeshNormalsProps extends RefAttributes<PIXI.Mesh<PIXI.Geometry, PIXI.Shader>>,
	Omit<PixiCustomMeshProps<PIXI.Geometry, PIXI.Shader>, 'geometry' | 'shader' | 'state'> {
	vertices: LayerVerticesTransformData;
	uvs: Float32Array;
	triangles: Uint32Array;
	texture: PIXI.Texture;
	normalMapTexture: PIXI.Texture;
	normalMapData: LayerNormalData;
	state: PIXI.State;
	bonePalette?: GraphicsBonePalette;
	color: number;
	debugConfig?: Immutable<ChatroomDebugConfig>;
}

export function GraphicsLayerMeshNormals({
	ref,
	vertices,
	uvs,
	triangles,
	texture,
	normalMapTexture,
	normalMapData,
	state,
	color,
	debugConfig,
	bonePalette,
	...props
}: GraphicsLayerMeshNormalsProps): ReactElement {

	const geometry = useCallback<PixiCustomMeshGeometryCreator<PIXI.Geometry>>((existingGeometry) => {
		if (existingGeometry) {
			existingGeometry.getBuffer('aPosition').data = vertices.vertices;
			existingGeometry.getBuffer('aUV').data = uvs;
			existingGeometry.getBuffer('aBoneIndices').data = vertices.vertexSkinningBoneIndices;
			existingGeometry.getBuffer('aBoneWeights').data = vertices.vertexSkinningBoneWeights;
			existingGeometry.indexBuffer.data = triangles;
			return existingGeometry;
		} else {
			const positionBuffer = new PIXI.Buffer({
				data: vertices.vertices,
				label: 'attribute-mesh-positions',
				shrinkToFit: true,
				// eslint-disable-next-line no-bitwise
				usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
			});

			const uvBuffer = new PIXI.Buffer({
				data: uvs,
				label: 'attribute-mesh-uvs',
				shrinkToFit: true,
				// eslint-disable-next-line no-bitwise
				usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
			});

			const boneIndicesBuffer = new PIXI.Buffer({
				data: vertices.vertexSkinningBoneIndices,
				label: 'attribute-mesh-vertex-rotations',
				shrinkToFit: true,
				// eslint-disable-next-line no-bitwise
				usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
			});

			const boneWeightsBuffer = new PIXI.Buffer({
				data: vertices.vertexSkinningBoneWeights,
				label: 'attribute-mesh-vertex-rotations',
				shrinkToFit: true,
				// eslint-disable-next-line no-bitwise
				usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
			});

			const indexBuffer = new PIXI.Buffer({
				data: triangles,
				label: 'index-mesh-buffer',
				shrinkToFit: true,
				// eslint-disable-next-line no-bitwise
				usage: PIXI.BufferUsage.INDEX | PIXI.BufferUsage.COPY_DST,
			});

			const geometryInstance = new PIXI.Geometry(({
				attributes: {
					aPosition: {
						buffer: positionBuffer,
						format: 'float32x2',
						stride: 2 * 4,
						offset: 0,
					},
					aUV: {
						buffer: uvBuffer,
						format: 'float32x2',
						stride: 2 * 4,
						offset: 0,
					},
					aBoneIndices: {
						buffer: boneIndicesBuffer,
						format: 'uint16x4',
						stride: 4 * 2,
						offset: 0,
					},
					aBoneWeights: {
						buffer: boneWeightsBuffer,
						format: 'float32x4',
						stride: 4 * 4,
						offset: 0,
					},
				},
				indexBuffer,
				topology: 'triangle-list',
			}));

			return geometryInstance;
		}
	}, [triangles, uvs, vertices]);

	const shader = useMemo((): PixiCustomMeshShaderCreator<PIXI.Shader> => {
		return (existingShader) => CreateOrUpdateNormalMeshShader(existingShader, {
			texture, normalMapTexture, normalMapData, color,
			displayNormalMap: debugConfig?.displayNormalMap,
			boneTransforms: vertices.boneTransforms,
			bonePalette,
		});
	}, [texture, normalMapTexture, normalMapData, color, debugConfig, vertices, bonePalette]);

	return (
		<PixiCustomMesh
			{ ...props }
			ref={ ref }
			geometry={ geometry }
			shader={ shader }
			state={ state }
		/>
	);
}
