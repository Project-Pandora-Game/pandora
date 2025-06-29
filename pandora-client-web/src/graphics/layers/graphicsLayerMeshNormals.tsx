import type { LayerNormalData } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { PixiCustomMesh, PixiCustomMeshGeometryCreator, type PixiCustomMeshShaderCreator } from '../baseComponents/customMesh.tsx';
import { DEFAULT_NORMAL_TEXTURE, NORMAL_MESH_GL_PROGRAM } from './graphicsLayerMeshNormalsShader.ts';

export interface GraphicsLayerMeshNormalsProps {
	vertices: Float32Array;
	vertexRotations: Float32Array;
	uvs: Float32Array;
	triangles: Uint32Array;
	texture: PIXI.Texture;
	normalMapTexture: PIXI.Texture;
	normalMapData: LayerNormalData;
	state: PIXI.State;
	color: number;
	alpha: number;
}

export function GraphicsLayerMeshNormals({
	vertices,
	vertexRotations,
	uvs,
	triangles,
	texture,
	normalMapTexture,
	normalMapData,
	state,
	color,
	alpha,
}: GraphicsLayerMeshNormalsProps): ReactElement {

	const geometry = useCallback<PixiCustomMeshGeometryCreator<PIXI.Geometry>>((existingGeometry) => {
		if (existingGeometry) {
			existingGeometry.getBuffer('aPosition').data = vertices;
			existingGeometry.getBuffer('aUV').data = uvs;
			existingGeometry.getBuffer('aRotation').data = vertexRotations;
			existingGeometry.indexBuffer.data = triangles;
			return existingGeometry;
		} else {
			const positionBuffer = new PIXI.Buffer({
				data: vertices,
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

			const vertexRotationBuffer = new PIXI.Buffer({
				data: vertexRotations,
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
					aRotation: {
						buffer: vertexRotationBuffer,
						format: 'float32',
						stride: 1 * 4,
						offset: 0,
					},
				},
				indexBuffer,
				topology: 'triangle-list',
			}));

			return geometryInstance;
		}
	}, [triangles, uvs, vertices, vertexRotations]);

	const shader = useMemo((): PixiCustomMeshShaderCreator<PIXI.Shader> => {
		const normalMap = normalMapTexture === PIXI.Texture.WHITE ? DEFAULT_NORMAL_TEXTURE : normalMapTexture;
		const ambientStrength = 0.1;
		const { specularStrength, roughness } = normalMapData;
		// eslint-disable-next-line no-bitwise
		const colorAlpha = PIXI.Color.shared.setValue(color).toBgrNumber() + (((255) | 0) << 24);

		return (existingShader) => {
			if (existingShader) {
				/* eslint-disable @typescript-eslint/no-unsafe-member-access */
				existingShader.resources.uTexture = texture.source;
				existingShader.resources.uSampler = texture.source.style;
				existingShader.resources.uNormalMap = normalMap.source;
				existingShader.resources.uNormalSampler = normalMap.source.style;
				existingShader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
				PIXI.color32BitToUniform(colorAlpha, existingShader.resources.textureUniforms.uniforms.uBaseColor as Float32Array, 0);
				existingShader.resources.pbrUniforms.uniforms.uAmbientStrength = ambientStrength;
				existingShader.resources.pbrUniforms.uniforms.uSpecularStrength = specularStrength;
				existingShader.resources.pbrUniforms.uniforms.uRoughness = roughness;
				/* eslint-enable @typescript-eslint/no-unsafe-member-access */
				return existingShader;
			} else {
				const uBaseColor = new Float32Array([1, 1, 1, 1]);
				PIXI.color32BitToUniform(colorAlpha, uBaseColor, 0);
				return new PIXI.Shader({
					glProgram: NORMAL_MESH_GL_PROGRAM,
					resources: {
						uTexture: texture.source,
						uSampler: texture.source.style,
						uNormalMap: normalMap.source,
						uNormalSampler: normalMap.source.style,
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
		};
	}, [texture, normalMapTexture, normalMapData, color]);

	return (
		<PixiCustomMesh
			geometry={ geometry }
			shader={ shader }
			state={ state }
			alpha={ alpha }
		/>
	);
}
