import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback, useMemo } from 'react';
import dotTexture from '../../../assets/editor/dotTexture.png';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';
import { Container } from '../../../graphics/baseComponents/container';
import { Graphics } from '../../../graphics/baseComponents/graphics';
import { Sprite } from '../../../graphics/baseComponents/sprite';
import { GraphicsLayerProps, useLayerPoints, useLayerVertices } from '../../../graphics/graphicsLayer';
import { useTexture } from '../../../graphics/useTexture';
import { useNullableObservable, useObservable } from '../../../observable';
import { PreviewCutterRectangle } from '../../components/previewCutter/previewCutter';
import { useEditor } from '../../editorContextProvider';
import { EDITOR_LAYER_Z_INDEX_EXTRA, EditorLayer } from './editorLayer';
import { isEqual } from 'lodash';
import { useLayerDefinition } from '../../../assets/assetGraphicsCalculations';
import { MeshFaceIsCW } from '../../../graphics/utility';
import { Assert } from 'pandora-common';

export function ResultLayer({
	layer,
	item,
	characterState,
	...props
}: GraphicsLayerProps): ReactElement {
	const editor = useEditor();
	const showHelpers = useObservable(editor.targetLayer) === layer;

	const { points: pointTemplate } = useLayerDefinition(layer);
	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const vertices = useLayerVertices(evaluator, points, layer, item);

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [vertices[2 * p], vertices[2 * p + 1]]);
			Assert(poly.length === 6);

			// Highlight any faces that got reversed - they signify potential problems
			const isCCW = !MeshFaceIsCW(...(poly as [number, number, number, number, number, number]));

			g.poly(poly);

			if (isCCW) {
				g
					.fill({ color: 0xff4444, alpha: 0.8 })
					.stroke({ width: 2, color: 0xff0000, alpha: 0.8 });
			} else {
				g
					.stroke({ width: 1, color: 0x333333, alpha: 0.2 });
			}
		}
	}, [triangles, vertices]);

	const editedTemplate = useObservable(editor.targetTemplate);
	const pointEditSelectedPoint = useNullableObservable(editedTemplate?.targetPoint);
	const pointTexture = useTexture(dotTexture);
	const displayPoints = useMemo<readonly [number, number][]>(() => {
		const res: [number, number][] = [];
		for (let i = 0; i < vertices.length; i += 2) {
			res.push([vertices[i], vertices[i + 1]]);
		}
		return res;
	}, [vertices]);

	return (
		<>
			<EditorLayer
				{ ...props }
				layer={ layer }
				item={ item }
				characterState={ characterState }
			/>
			{
				!showHelpers ? null : (
					<Graphics
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
						draw={ drawWireFrame }
					/>
				)
			}
			{
				!showHelpers ? null : (
					<Container
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
					>
						{ displayPoints.map((p, i) => (
							<Sprite key={ i }
								texture={ pointTexture }
								tint={
									(editedTemplate?.templateName === pointTemplate && isEqual(pointEditSelectedPoint?.definition.value.index, points[i].index)) ?
									0xffff00 : 0xffffff
								}
								anchor={ [0.5, 0.5] }
								scale={ [0.5, 0.5] }
								alpha={ 0.5 }
								position={ p }
							/>
						)) }
					</Container>
				)
			}
			<PreviewCutterRectangle />
		</>
	);
}
