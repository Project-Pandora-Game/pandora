import * as PIXI from 'pixi.js';
import { DraggablePointDisplay } from '../draggable';
import { EditorLayer, EDITOR_LAYER_Z_INDEX_EXTRA } from './editorLayer';
import { AssetFrameworkCharacterState } from 'pandora-common';
import { GraphicsLayerProps, useItemColor, useLayerPoints, useLayerVertices } from '../../../graphics/graphicsLayer';
import React, { ReactElement, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useEditor } from '../../editorContextProvider';
import { useObservable } from '../../../observable';
import { Container, Graphics, Sprite } from '@pixi/react';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';
import { AssetGraphicsLayer, useLayerDefinition, useLayerImageSource } from '../../../assets/assetGraphics';
import { useCharacterAppearanceItems } from '../../../character/character';
import { Texture } from 'pixi.js';
import { EditorAssetGraphics } from '../character/appearanceEditor';
import { useTexture } from '../../../graphics/useTexture';
import { useEditorLayerStateOverride } from '../../editor';

export function SetupLayer({
	layer,
	item,
	characterState,
	...props
}: GraphicsLayerProps): ReactElement {
	const evaluator = useAppearanceConditionEvaluator(characterState);

	const {
		imageUv,
	} = useLayerImageSource(evaluator, layer, item);

	return (
		<EditorLayer
			{ ...props }
			layer={ layer }
			item={ item }
			verticesPoseOverride={ imageUv }
			characterState={ characterState }
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

	const { points, triangles } = useLayerPoints(layer);

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

	const uv = useLayerVertices(evaluator, points, layer, item, true, imageUv);

	const drawWireFrame = useCallback((g: PIXI.Graphics) => {
		g.clear().lineStyle(1, 0x333333, 0.2);
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [uv[2 * p] * width + x, uv[2 * p + 1] * height + y]);
			g.drawPolygon(poly);
		}
	}, [triangles, uv, x, y, width, height]);

	const displayPoints = useObservable(editor.targetLayerPoints);

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
			<Container
				zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
			>
				{ displayPoints.map((p, i) => <DraggablePointDisplay draggablePoint={ p } key={ i } />) }
			</Container>
		</Container>
	);
}
