import { AssetFrameworkCharacterState } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Texture } from 'pixi.js';
import { ReactElement, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useLayerImageSource, useLayerMeshPoints } from '../../../assets/assetGraphicsCalculations.ts';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { Sprite } from '../../../graphics/baseComponents/sprite.ts';
import { useItemColor, useLayerVertices, type GraphicsLayerProps } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { useTexture } from '../../../graphics/useTexture.ts';
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { useEditorLayerStateOverride } from '../../editor.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA, EditorLayer } from './editorLayer.tsx';

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
	layer,
	...props
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: EditorAssetGraphicsLayer;
}): ReactElement | null {
	switch (layer.type) {
		case 'mesh':
			return <SetupMeshLayerSelected { ...props } layer={ layer } />;
	}
	return null;
}

export function SetupMeshLayerSelected({
	characterState,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: EditorAssetGraphicsLayer<'mesh'>;
}): ReactElement {
	const editor = useEditor();
	const state = useEditorLayerStateOverride(layer);
	const item = characterState.items.find((i) => i.asset.id === layer.asset.id) ?? null;

	const definition = useObservable(layer.definition);
	const {
		height,
		width,
		colorizationKey,
		x, y,
	} = definition;

	const { points, triangles } = useLayerMeshPoints(definition);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const {
		image,
		imageUv,
	} = useLayerImageSource(evaluator, definition, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, false, imageUv);
	const uv = useLayerVertices(evaluatorUvPose, points, definition, item, true);

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Draw triangles
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [uv[2 * p] * width + x, uv[2 * p + 1] * height + y]);
			g
				.poly(poly)
				.stroke({ width: 1, color: 0x333333, alpha: 0.2, pixelLine: true });
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
		return (i) => asset.getTexture(i);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [asset, editorGettersVersion]);

	useEffect(() => {
		return editor.on('modifiedAssetsChange', () => editorGettersUpdate());
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
