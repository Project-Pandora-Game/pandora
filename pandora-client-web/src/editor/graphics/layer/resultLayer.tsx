import { isEqual } from 'lodash-es';
import { Assert } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { useLayerDefinition, useLayerMeshPoints } from '../../../assets/assetGraphicsCalculations.ts';
import dotTexture from '../../../assets/editor/dotTexture.png';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { Sprite } from '../../../graphics/baseComponents/sprite.ts';
import { GraphicsLayerProps, useLayerVertices } from '../../../graphics/graphicsLayer.tsx';
import { useTexture } from '../../../graphics/useTexture.ts';
import { MeshFaceIsCW } from '../../../graphics/utility.ts';
import { useNullableObservable, useObservable } from '../../../observable.ts';
import { PreviewCutterRectangle } from '../../components/previewCutter/previewCutter.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA, EditorLayer } from './editorLayer.tsx';

export function ResultLayer({
	layer,
	item,
	characterState,
	...props
}: GraphicsLayerProps): ReactElement {
	const editor = useEditor();
	const showHelpers = useObservable(editor.targetLayer) === layer;

	const { points: pointTemplate, x, y, width, height } = useLayerDefinition(layer);
	const { points, triangles } = useLayerMeshPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const vertices = useLayerVertices(evaluator, points, layer, item);

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Borders of the layer
		g.rect(x, y, width, height)
			.stroke({ width: 2, color: 0x000088, alpha: 0.6 });

		// Wireframe of the points template
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
	}, [triangles, vertices, x, y, width, height]);

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
