import * as PIXI from 'pixi.js';
import { ReactElement, useContext, useMemo } from 'react';
import { useImageResolutionAlternative, useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { useTexture } from '../useTexture.ts';
import { ContextCullClockwise, useItemColor, useLayerVertices, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMeshNormals } from './graphicsLayerMeshNormals.tsx';

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

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			{
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
