import * as PIXI from 'pixi.js';
import { ReactElement, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
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
		depthComponent,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, currentlyBlinking, imageUv);

	const vertices = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator, points, layer, item, false);
	const uv = useLayerVertices(evaluatorUvPose, points, layer, item, true);

	const texture = useTexture(useImageResolutionAlternative(image).image, undefined, getTexture);
	const depthTexture = useTexture(useImageResolutionAlternative(depthComponent ?? '').image || '*', undefined, getTexture);

	const { color, alpha } = useItemColor(characterState.items, item, layer.colorizationKey, state);

	const cullClockwise = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	const shader = useMemo(() => {
		if (depthTexture === PIXI.Texture.WHITE)
			return undefined;

		depthTexture.source.format = 'r16float';

		const uPix = new Float32Array(3);
		uPix[0] = 1 / layer.width;
		uPix[1] = 1 / layer.height;
		uPix[2] = 0;

		return new PIXI.Shader({
			glProgram,
			resources: {
				uTexture: PIXI.Texture.EMPTY.source,
				uDepthTexture: depthTexture.source,
				uDepthSampler: depthTexture.source.style,
				textureUniforms: new PIXI.UniformGroup({
					uTextureMatrix: { type: 'mat3x3<f32>', value: new PIXI.Matrix() },
					uPix: { type: 'vec3<f32>', value: uPix },
				}),
			},
		});
	}, [depthTexture, layer.height, layer.width]);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<PixiMesh
				state={ cullingState }
				vertices={ vertices }
				uvs={ uv }
				indices={ triangles }
				texture={ texture }
				shader={ shader }
				tint={ color }
				alpha={ alpha }
			/>
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
		`,
				main: /* glsl */`
uv = (uTextureMatrix * vec3(uv, 1.0)).xy;
		`,
			},
			fragment: {
				header: /* glsl */`
uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec3 uPix; // normalized size of a pixel, zero in z for convenience

float getHeight(vec2 pos) {
	return 1. - texture(uDepthTexture, pos).x;
}

vec3 getNormal(vec2 pos) {
	float h = 150.;
	float l = h * getHeight(pos - uPix.xz);
	float r = h * getHeight(pos + uPix.xz);
	float d = h * getHeight(pos - uPix.zy);
	float u = h * getHeight(pos + uPix.zy);

	return normalize(vec3(l-r, d-u, 1.));
}

float getNormalShadow(vec2 pos) {
	return clamp(1. - (dot(getNormal(pos), normalize(vec3(2.7, -2.5, 3.7))) + 1.)/2., 0., 1.);
}

		`,
				main: /* glsl */`
float lightStrength = 1. - (0.8 * getNormalShadow(vUV));

outColor = texture(uTexture, vUV);
outColor.xyz = vec3(outColor.w); // DEBUG
outColor.xyz *= lightStrength;
		`,
			},
		},
		PIXI.roundPixelsBitGl,
	],
});

