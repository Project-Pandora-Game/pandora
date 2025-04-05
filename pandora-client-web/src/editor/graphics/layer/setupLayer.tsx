import { AssetFrameworkCharacterState } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Texture } from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
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
		case 'alphaImageMesh':
			return <SetupAlphaImageMeshLayerSelected { ...props } layer={ layer } />;
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
				.circle(point.pos[0], point.pos[1], 2)
				.fill({ color: 0xcccccc, alpha: 0.8 })
				.stroke({ width: 1, color: 0x000000, alpha: 0.8, pixelLine: true });
		}
	}, [points, triangles, uv, x, y, width, height]);

	const asset = layer.asset;
	const editorAssetTextures = useObservable(asset.textures);

	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		return (i) => (editorAssetTextures.get(i) ?? Texture.EMPTY);
	}, [editorAssetTextures]);

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

export function SetupAlphaImageMeshLayerSelected({
	characterState,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: EditorAssetGraphicsLayer<'alphaImageMesh'>;
}): ReactElement {
	const item = characterState.items.find((i) => i.asset.id === layer.asset.id) ?? null;

	const definition = useObservable(layer.definition);
	const {
		height,
		width,
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
				.circle(point.pos[0], point.pos[1], 2)
				.fill({ color: 0xcccccc, alpha: 0.8 })
				.stroke({ width: 1, color: 0x000000, alpha: 0.8, pixelLine: true });
		}
	}, [points, triangles, uv, x, y, width, height]);

	const asset = layer.asset;
	const editorAssetTextures = useObservable(asset.textures);

	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		return (i) => (editorAssetTextures.get(i) ?? Texture.EMPTY);
	}, [editorAssetTextures]);

	const texture = useTexture(image, undefined, editorGetTexture);

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
			/>
			<Graphics
				zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
				draw={ drawWireFrame }
			/>
		</Container>
	);
}
