import * as PIXI from 'pixi.js';
import { DraggablePointDisplay } from '../draggable';
import { EditorLayer, EDITOR_LAYER_Z_INDEX_EXTRA } from './editorLayer';
import { BoneName, LayerImageSetting } from 'pandora-common';
import { GraphicsLayerProps, useLayerPoints, useLayerVertices } from '../../../graphics/graphicsLayer';
import React, { ReactElement, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useEditor } from '../../editorContextProvider';
import { useObservable } from '../../../observable';
import { Container, Graphics, Sprite } from '@saitonakamura/react-pixi';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';
import { max, maxBy, min, minBy } from 'lodash';
import { AssetGraphicsLayer, useLayerDefinition } from '../../../assets/assetGraphics';
import { AppearanceContainer, useCharacterAppearanceItems } from '../../../character/character';
import { Texture } from 'pixi.js';
import { EditorAssetGraphics } from '../character/appearanceEditor';
import { useTexture } from '../../../graphics/useTexture';
import { EvaluateCondition } from '../../../graphics/utility';
import { Immutable } from 'immer';
import { useEditorLayerStateOverride } from '../../editor';

export function SetupLayer({
	layer,
	item,
	appearanceContainer,
	...props
}: GraphicsLayerProps): ReactElement {
	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const { scaling } = useLayerDefinition(layer);

	const uvPose = useMemo<Record<BoneName, number>>(() => {
		if (scaling) {
			let settingValue: number | undefined;
			const stops = scaling.stops.map((stop) => stop[0]);
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				settingValue = max(stops.filter((stop) => stop > 0 && stop <= value));
			} else if (value < 0) {
				settingValue = min(stops.filter((stop) => stop < 0 && stop >= value));
			}
			if (settingValue) {
				return { [scaling.scaleBone]: settingValue };
			}
		}
		return {};
	}, [evaluator, scaling]);

	return (
		<EditorLayer
			{ ...props }
			layer={ layer }
			item={ item }
			verticesPoseOverride={ uvPose }
			appearanceContainer={ appearanceContainer }
		/>
	);
}

export function SetupLayerSelected({
	appearanceContainer,
	zIndex,
	layer,
}: {
	appearanceContainer: AppearanceContainer;
	zIndex: number;
	layer: AssetGraphicsLayer,
}): ReactElement {
	const editor = useEditor();
	const state = useEditorLayerStateOverride(layer);
	const items = useCharacterAppearanceItems(appearanceContainer);
	const item = items.find((i) => i.asset.id === layer.asset.asset.id) ?? null;

	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const {
		image: scalingBaseimage,
		scaling,
		height,
		width,
		colorizationIndex,
		x, y,
	} = useLayerDefinition(layer);

	const uvPose = useMemo<Record<BoneName, number>>(() => {
		if (scaling) {
			let settingValue: number | undefined;
			const stops = scaling.stops.map((stop) => stop[0]);
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				settingValue = max(stops.filter((stop) => stop > 0 && stop <= value));
			} else if (value < 0) {
				settingValue = min(stops.filter((stop) => stop < 0 && stop >= value));
			}
			if (settingValue) {
				return { [scaling.scaleBone]: settingValue };
			}
		}
		return {};
	}, [evaluator, scaling]);

	const uv = useLayerVertices(evaluator, points, layer, item, true, uvPose);

	const drawWireFrame = useCallback((g: PIXI.Graphics) => {
		g.clear().lineStyle(1, 0x333333, 0.2);
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [uv[2 * p] * width, uv[2 * p + 1] * height]);
			g.drawPolygon(poly);
		}
	}, [height, triangles, uv, width]);

	const displayPoints = useObservable(editor.targetLayerPoints);

	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const asset = layer.asset;

	// TODO: Make editor asset's images observable
	const editorGetTexture = useMemo<((image: string) => Promise<Texture>) | undefined>(() => {
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

	const setting = useMemo<Immutable<LayerImageSetting>>(() => {
		if (scaling) {
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				return maxBy(scaling.stops.filter((stop) => stop[0] > 0 && stop[0] <= value), (stop) => stop[0])?.[1] ?? scalingBaseimage;
			} else if (value < 0) {
				return minBy(scaling.stops.filter((stop) => stop[0] < 0 && stop[0] >= value), (stop) => stop[0])?.[1] ?? scalingBaseimage;
			}
		}
		return scalingBaseimage;
	}, [evaluator, scaling, scalingBaseimage]);

	const image = useMemo<string>(() => {
		return setting.overrides.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? setting.image;
	}, [evaluator, item, setting]);

	const texture = useTexture(image, undefined, editorGetTexture);

	const color: number = state?.color ??
		(
			(
				item != null &&
				colorizationIndex != null &&
				colorizationIndex >= 0 &&
				colorizationIndex < item.color.length
			) ? Number.parseInt(item.color[colorizationIndex].slice(1), 16) : undefined
		) ??
		0xffffff;

	const alpha = state?.alpha ?? 1;

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<Sprite
				x={ x }
				y={ y }
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
