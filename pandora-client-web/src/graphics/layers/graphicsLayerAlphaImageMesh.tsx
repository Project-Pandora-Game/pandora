import {
	CharacterSize,
	Rectangle as PandoraRectangle,
} from 'pandora-common';
import { memo, ReactElement, useMemo } from 'react';
import { useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, type AppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { type PixiMeshProps } from '../baseComponents/mesh.tsx';
import { CompactMaskMeshPoints } from '../graphicsMaskGeometry.ts';
import { useGraphicsSettings } from '../graphicsSettings.tsx';
import { usePixiApp, usePixiAppOptional } from '../reconciler/appContext.ts';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { useLayerVertices, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';
import { GraphicsDirectMaskContainer } from './graphicsDirectMaskContainer.tsx';

export const GraphicsLayerAlphaImageMesh = memo(function GraphicsLayerAlphaImageMeshImpl(props: GraphicsLayerProps<'alphaImageMesh'> & ChildrenProps): ReactElement {
	const { alphamaskEngine } = useGraphicsSettings();
	const app = usePixiAppOptional();
	// A disabled mask must not deform geometry or load its texture.
	if (alphamaskEngine === 'disabled' || !app)
		return <Container>{ props.children }</Container>;
	return <GraphicsLayerAlphaImageMeshEnabled { ...props } />;
});

function GraphicsLayerAlphaImageMeshEnabled(props: GraphicsLayerProps<'alphaImageMesh'> & ChildrenProps): ReactElement {
	const { layer, item, poseEvaluator, wornItems, characterBlinking, children } = props;
	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(poseEvaluator, wornItems, currentlyBlinking);
	if (layer.enableCond != null && !EvaluateCondition(layer.enableCond, (c) => evaluator.evalCondition(c, item)))
		return <Container>{ children }</Container>;
	return <GraphicsLayerAlphaImageMeshGeometry { ...props } evaluator={ evaluator } />;
}

function GraphicsLayerAlphaImageMeshGeometry({
	children, layer, item, poseEvaluator, displayUvPose = false, evaluator,
}: GraphicsLayerProps<'alphaImageMesh'> & ChildrenProps & { evaluator: AppearanceConditionEvaluator; }): ReactElement {
	const mesh = useLayerMeshPoints(layer);
	const { points, triangles } = CompactMaskMeshPoints(mesh.points, mesh.triangles);
	const { image, imageUvPose } = useLayerImageSource(evaluator, layer, item);
	const evaluatorUvPose = useCharacterPoseEvaluator(poseEvaluator.assetManager, imageUvPose);
	const vertices = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator.poseEvaluator, points, layer, false).vertices;
	const uv = useLayerVertices(evaluatorUvPose, points, layer, true).vertices;
	const alphaMesh = useMemo(() => ({ vertices, uvs: uv, indices: triangles }), [vertices, uv, triangles]);
	return <MaskContainer maskImage={ image } maskMesh={ alphaMesh }>{ children }</MaskContainer>;
}

const MASK_X_OVERSCAN = 250;
export const MASK_SIZE: Readonly<PandoraRectangle> = {
	x: MASK_X_OVERSCAN,
	y: 0,
	width: CharacterSize.WIDTH + 2 * MASK_X_OVERSCAN,
	height: CharacterSize.HEIGHT,
};
interface MaskContainerProps extends ChildrenProps {
	maskImage: string;
	maskMesh?: Pick<PixiMeshProps, 'vertices' | 'uvs' | 'indices'>;
}

function MaskContainer({ children, maskImage, maskMesh }: MaskContainerProps): ReactElement {
	const app = usePixiApp();
	const texture = useTexture(maskImage, true);
	return <GraphicsDirectMaskContainer app={ app } texture={ texture } maskMesh={ maskMesh }>{ children }</GraphicsDirectMaskContainer>;
}
