import type { Immutable } from 'immer';
import { Assert, MAX_BONE_COUNT, type LayerNormalData } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo, type RefAttributes } from 'react';
import type { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { PixiCustomMesh, PixiCustomMeshGeometryCreator, type PixiCustomMeshProps, type PixiCustomMeshShaderCreator } from '../baseComponents/customMesh.tsx';
import type { LayerVerticesTransformData } from './graphicsLayerCommon.tsx';
import { DEFAULT_NORMAL_TEXTURE, NORMAL_MESH_DEBUG_NORMALS_GL_PROGRAM, NORMAL_MESH_GL_PROGRAM } from './graphicsLayerMeshNormalsShader.ts';

export interface GraphicsLayerMeshNormalsProps extends RefAttributes<PIXI.Mesh<PIXI.Geometry, PIXI.Shader>>,
	Omit<PixiCustomMeshProps<PIXI.Geometry, PIXI.Shader>, 'geometry' | 'shader' | 'state'> {
	vertices: LayerVerticesTransformData;
	uvs: Float32Array;
	triangles: Uint32Array;
	texture: PIXI.Texture;
	normalMapTexture: PIXI.Texture;
	normalMapData: LayerNormalData;
	state: PIXI.State;
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
		const program = debugConfig?.displayNormalMap ? NORMAL_MESH_DEBUG_NORMALS_GL_PROGRAM : NORMAL_MESH_GL_PROGRAM;

		const normalMap = normalMapTexture === PIXI.Texture.WHITE ? DEFAULT_NORMAL_TEXTURE : normalMapTexture;
		const ambientStrength = 0.1;
		const { specularStrength, roughness } = normalMapData;
		// eslint-disable-next-line no-bitwise
		const colorAlpha = PIXI.Color.shared.setValue(color).toBgrNumber() + (((255) | 0) << 24);

		return (existingShader) => {
			Assert(vertices.boneTransforms.length === 8 * MAX_BONE_COUNT, 'Invalid boneTransforms length');

			if (existingShader && existingShader.glProgram === program) {
				/* eslint-disable @typescript-eslint/no-unsafe-member-access */
				existingShader.resources.uTexture = texture.source;
				existingShader.resources.uSampler = texture.source.style;
				existingShader.resources.uNormalMap = normalMap.source;
				existingShader.resources.uNormalSampler = normalMap.source.style;
				existingShader.resources.skinningUniforms.uniforms.uBoneQuat = vertices.boneTransforms;
				existingShader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
				if (!debugConfig?.displayNormalMap) {
					PIXI.color32BitToUniform(colorAlpha, existingShader.resources.textureUniforms.uniforms.uBaseColor as Float32Array, 0);
					existingShader.resources.pbrUniforms.uniforms.uAmbientStrength = ambientStrength;
					existingShader.resources.pbrUniforms.uniforms.uSpecularStrength = specularStrength;
					existingShader.resources.pbrUniforms.uniforms.uRoughness = roughness;
				}
				/* eslint-enable @typescript-eslint/no-unsafe-member-access */
				return existingShader;
			} else {
				if (debugConfig?.displayNormalMap) {
					const uBaseColor = new Float32Array([1, 1, 1, 1]);
					PIXI.color32BitToUniform(colorAlpha, uBaseColor, 0);
					return new PIXI.Shader({
						glProgram: program,
						resources: {
							uTexture: texture.source,
							uSampler: texture.source.style,
							uNormalMap: normalMap.source,
							uNormalSampler: normalMap.source.style,
							skinningUniforms: new PIXI.UniformGroup({
								uBoneQuat: { type: 'vec4<f32>', size: 2 * MAX_BONE_COUNT, value: vertices.boneTransforms },
							}),
							textureUniforms: new PIXI.UniformGroup({
								uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
							}),
						},
					});
				} else {
					const uBaseColor = new Float32Array([1, 1, 1, 1]);
					PIXI.color32BitToUniform(colorAlpha, uBaseColor, 0);
					return new PIXI.Shader({
						glProgram: program,
						resources: {
							uTexture: texture.source,
							uSampler: texture.source.style,
							uNormalMap: normalMap.source,
							uNormalSampler: normalMap.source.style,
							skinningUniforms: new PIXI.UniformGroup({
								// The type actually is mat2x4<f32>, but pixi doesn't support it properly
								uBoneQuat: { type: 'vec4<f32>', size: 2 * MAX_BONE_COUNT, value: vertices.boneTransforms },
							}),
							textureUniforms: new PIXI.UniformGroup({
								uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
								uBaseColor: { value: uBaseColor, type: 'vec4<f32>' },
							}),
							pbrUniforms: new PIXI.UniformGroup({
								uAmbientStrength: { type: 'f32', value: ambientStrength },
								uSpecularStrength: { type: 'f32', value: specularStrength },
								uRoughness: { type: 'f32', value: roughness },
							}),
						},
					});
				}
			}
		};
	}, [texture, normalMapTexture, normalMapData, color, debugConfig, vertices]);

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
