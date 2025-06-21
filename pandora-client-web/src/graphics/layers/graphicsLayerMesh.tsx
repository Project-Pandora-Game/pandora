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
		if (normalMapTexture === PIXI.Texture.WHITE)
			return undefined;

		// normalTexture.source.format = 'rgba8unorm';

		return (existingShader) => {
			if (existingShader) {
				existingShader.resources.uTexture = texture.source;
				existingShader.resources.uSampler = texture.source.style;
				existingShader.resources.uNormalMap = normalMapTexture.source;
				existingShader.resources.uNormalSampler = normalMapTexture.source.style;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				existingShader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
				return existingShader;
			} else {
				return new PIXI.Shader({
					glProgram,
					resources: {
						uTexture: texture.source,
						uSampler: texture.source.style,
						uNormalMap: normalMapTexture.source,
						uNormalSampler: normalMapTexture.source.style,
						textureUniforms: new PIXI.UniformGroup({
							uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
						}),
					},
				});
			}
		};
	}, [texture, normalMapTexture]);

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

float getNormalShadow(vec2 pos) {
	vec3 lightAngle = normalize(vec3(2.7, -2.5, 3.7));
	return clamp(1. - (dot(getNormal(pos), lightAngle) + 1.)/2., 0., 1.);
}

		`,
				main: /* glsl */`
float lightStrength = 1. - (0.8 * getNormalShadow(vUV));

outColor = texture(uTexture, vUV);
outColor.xyz *= lightStrength;
		`,
			},
		},
		PIXI.roundPixelsBitGl,
	],
});

