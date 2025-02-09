import { AssetFrameworkCharacterState } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Texture } from 'pixi.js';
import { ReactElement, useCallback, useEffect, useMemo, useReducer } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { useLayerDefinition, useLayerImageSource, useLayerMeshPoints } from '../../../assets/assetGraphicsCalculations';
import { useCharacterAppearanceItems } from '../../../character/character';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';
import { Container } from '../../../graphics/baseComponents/container';
import { Graphics } from '../../../graphics/baseComponents/graphics';
import { Sprite } from '../../../graphics/baseComponents/sprite';
import { GraphicsLayerProps, useItemColor, useLayerVertices } from '../../../graphics/graphicsLayer';
import { useTexture } from '../../../graphics/useTexture';
import { useEditorLayerStateOverride } from '../../editor';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../character/appearanceEditor';
import { EDITOR_LAYER_Z_INDEX_EXTRA, EditorLayer } from './editorLayer';

export function SetupLayer({
	...props
}: GraphicsLayerProps): ReactElement {
	return (
		<EditorLayer
			{ ...props }
			displayUvPose
		/>
	);
}

export function SetupLayerSelected({
	characterState,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: AssetGraphicsLayer;
}): ReactElement {
	const editor = useEditor();
	const state = useEditorLayerStateOverride(layer);
	const items = useCharacterAppearanceItems(characterState);
	const item = items.find((i) => i.asset.id === layer.asset.id) ?? null;

	const { points, triangles } = useLayerMeshPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const {
		height,
		width,
		colorizationKey,
		x, y,
	} = useLayerDefinition(layer);

	const {
		image,
		imageUv,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, false, imageUv);
	const uv = useLayerVertices(evaluatorUvPose, points, layer, item, true);

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Draw triangles
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [uv[2 * p] * width + x, uv[2 * p + 1] * height + y]);
			g
				.poly(poly)
				.stroke({ width: 1, color: 0x333333, alpha: 0.2 });
		}
		// Draw nice points on top of triangles
		for (const point of points) {
			g
				.circle(point.pos[0], point.pos[1], 2.5)
				.fill({ color: 0xcccccc, alpha: 0.8 })
				.stroke({ width: 1, color: 0x000000, alpha: 0.8 });
		}
	}, [points, triangles, uv, x, y, width, height]);

	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const asset = layer.asset;

	// TODO: Make editor asset's images observable
	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		if (asset instanceof EditorAssetGraphics)
			return (i) => asset.getTexture(i);
		return undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [layer, editorGettersVersion]);

	useEffect(() => {
		if (asset instanceof EditorAssetGraphics) {
			return editor.on('modifiedAssetsChange', () => editorGettersUpdate());
		}
		return undefined;
	}, [editor, asset]);

	const texture = useTexture(image, undefined, editorGetTexture);

	const { color, alpha } = useItemColor(characterState.items, item, colorizationKey, state);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<Sprite
				x={ x }
				y={ y }
				width={ width }
				height={ height }
				texture={ texture }
				tint={ color }
				alpha={ alpha }
			/>
			<Graphics
				zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
				draw={ drawWireFrame }
			/>
		</Container>
	);
}
