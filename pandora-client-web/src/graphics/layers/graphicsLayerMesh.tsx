import { noop } from 'lodash-es';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { PixiCustomMesh, PixiCustomMeshGeometryCreator, type PixiCustomMeshShaderCreator } from '../baseComponents/customMesh.tsx';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { useTexture } from '../useTexture.ts';
import { ContextCullClockwise, useItemColor, useLayerVertices, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';

export function GraphicsLayerMesh({
	characterState,
	children,
	zIndex,
	lowerZIndex,
	layer,
	item,
	displayUvPose = false,
	state,
	getTexture,
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

	const texture = useTexture(useImageResolutionAlternative(image).image, undefined, getTexture);
	const normalMapTexture = useTexture(useImageResolutionAlternative(normalMapImage ?? '').image || '*', undefined, getTexture);

	const { color, alpha } = useItemColor(characterState.items, item, layer.colorizationKey, state);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	const geometry = useCallback<PixiCustomMeshGeometryCreator<PIXI.Geometry>>((existingGeometry) => {
		if (existingGeometry) {
			existingGeometry.getBuffer('aPosition').data = vertices;
			existingGeometry.getBuffer('aUV').data = uv;
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
				data: uv,
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
	}, [triangles, uv, vertices, vertexRotations]);

	const shader = useMemo((): PixiCustomMeshShaderCreator<PIXI.Shader> | undefined => {
		if (!layer.normalMap)
			return undefined;

		const normalMap = normalMapTexture === PIXI.Texture.WHITE ? DEFAULT_NORMAL_TEXTURE : normalMapTexture;
		const ambientStrength = 0.1;
		const { specularStrength, roughness } = layer.normalMap;

		return (existingShader) => {
			if (existingShader) {
				existingShader.resources.uTexture = texture.source;
				existingShader.resources.uSampler = texture.source.style;
				existingShader.resources.uNormalMap = normalMap.source;
				existingShader.resources.uNormalSampler = normalMap.source.style;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				existingShader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				existingShader.resources.pbrUniforms.uniforms.uAmbientStrength = ambientStrength;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				existingShader.resources.pbrUniforms.uniforms.uSpecularStrength = specularStrength;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				existingShader.resources.pbrUniforms.uniforms.uRoughness = roughness;
				return existingShader;
			} else {
				return new PIXI.Shader({
					glProgram,
					resources: {
						uTexture: texture.source,
						uSampler: texture.source.style,
						uNormalMap: normalMap.source,
						uNormalSampler: normalMap.source.style,
						textureUniforms: new PIXI.UniformGroup({
							uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
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
	}, [texture, normalMapTexture, layer.normalMap]);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			{
			shader != null ? (
				<PixiCustomMesh
					geometry={ geometry }
					shader={ shader }
					state={ cullingState }
					tint={ color }
					alpha={ alpha }
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
			}
			<Container zIndex={ lowerZIndex }>
				{ children }
			</Container>
		</Container>
	);
}

export const DEFAULT_NORMAL_TEXTURE = new PIXI.Texture({
	source: new PIXI.BufferImageSource({
		resource: new Uint8Array([127, 127, 255, 255]),
		width: 1,
		height: 1,
		alphaMode: 'premultiply-alpha-on-upload',
		label: 'DEFAULT_NORMAL',
	}),
	label: 'DEFAULT_NORMAL',
});
DEFAULT_NORMAL_TEXTURE.destroy = noop;

/* TODO: Helpers

// Normals from height
float getHeight(vec2 pos) {
	return 1. - texture(uDepthTexture, pos).x;
}

float h = 150.;
float l = h * getHeight(pos - uPix.xz);
float r = h * getHeight(pos + uPix.xz);
float d = h * getHeight(pos - uPix.zy);
float u = h * getHeight(pos + uPix.zy);
return normalize(vec3(l-r, u-d, 1.));

// Display normals
outColor.xyz = packNormal(getNormal(vUV)) * outColor.w;

*/

const glProgram = PIXI.compileHighShaderGlProgram({
	name: 'mesh',
	bits: [
		PIXI.localUniformBitGl,
		{
			name: 'texture-bit',
			vertex: {
				header: /* glsl */`
uniform mat3 uTextureMatrix;
in float aRotation; // Rotation in radians per vertex
out mat3 vTBN;
		`,
				main: /* glsl */`
uv = (uTextureMatrix * vec3(uv, 1.0)).xy;

float cosA = cos(aRotation);
float sinA = sin(aRotation);
mat2 rotateMatrix = mat2(
	vec2(cosA, sinA),
	vec2(-sinA, cosA)
);

vec3 T = vec3(1., 0., 0.);
vec3 B = vec3(0., 1., 0.);
vec3 N = vec3(0., 0., 1.);

mat2 model2D = mat2(worldTransformMatrix * modelMatrix) * rotateMatrix;
T.xy = normalize(model2D * T.xy);
B.xy = normalize(model2D * B.xy);

vTBN = mat3(T, B, N);
		`,
			},
			fragment: {
				header: /* glsl */`
#version 300 es

uniform sampler2D uTexture;
uniform sampler2D uNormalMap;

vec3 ambientColour = vec3(1., 1., 1.);
vec3 lightColour = vec3(1., 1., 1.);

vec3 lightDir = normalize(vec3(2.7, -2.5, 3.7));

uniform float uAmbientStrength;
uniform float uSpecularStrength;
uniform float uRoughness;

in mat3 vTBN;

vec3 unpackNormal(vec3 color) {
	vec3 normal = color * 2. - 1.;
	// We are working in Pixi's coordinate system - X is right, Y is down, Z toward camera
	normal.y = -normal.y;
	return normal;
}

vec3 packNormal(vec3 normal) {
	normal.y = -normal.y;
	return (normal + 1.) / 2.;
}

vec3 getNormal(vec2 pos) {
	vec3 normal = unpackNormal(texture(uNormalMap, pos).rgb);
	normal = normalize(vTBN * normal);
	return normal;
}
		`,
				main: /* glsl */`
vec3 normal = getNormal(vUV);
outColor = texture(uTexture, vUV);

vec3 ambient = clamp(ambientColour * uAmbientStrength, 0., 1.);

float lambertian = clamp(dot(lightDir, normal), 0., 1.);
vec3 diffuse = (0.4 + 0.6 * lambertian) * lightColour;

vec3 specular = vec3(0.);
if (lambertian > 0.) {
	vec3 viewDir = normalize(vec3(0., 0., 1.));
	float shininess = pow(2., (1.0 - uRoughness) * 4.);

	vec3 reflection = 2.0 * dot(normal, lightDir) * normal - lightDir;
	float specularStrength = clamp(dot(reflection, viewDir), 0.0, 1.0);
	specularStrength = pow(specularStrength, shininess);
	specularStrength *= uSpecularStrength;

	// The specular color is from the light source, not the object
	if (specularStrength > 0.) {
		specular = lightColour * specularStrength;
		diffuse *= 1. - specularStrength;
	}
}

outColor *= vColor;
outColor.xyz *= (ambient + diffuse);
outColor.xyz += specular * outColor.w;
		`,
				// Skip Pixi's final tint step (with vColor) in here. We do it manually in a way it ignores specular light
				end: `
finalColor = outColor;
		`,
			},
		},
		PIXI.roundPixelsBitGl,
	],
});
