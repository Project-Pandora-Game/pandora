import { Texture } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { EditorLayer, EDITOR_LAYER_Z_INDEX_EXTRA } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';
import { GraphicsLayerProps, useLayerPoints, useLayerVertices } from '../../../graphics/graphicsLayer';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { useEditor } from '../../editorContextProvider';
import { useObservable } from '../../../observable';
import { Container, Graphics, Sprite } from '@pixi/react';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';

export function ResultLayer({
	layer,
	item,
	appearanceContainer,
	...props
}: GraphicsLayerProps): ReactElement {
	const editor = useEditor();
	const showHelpers = useObservable(editor.targetLayer) === layer;

	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const vertices = useLayerVertices(evaluator, points, layer, item);

	const drawWireFrame = useCallback((g: PIXI.Graphics) => {
		g.clear().lineStyle(1, 0x333333, 0.2);
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [vertices[2 * p], vertices[2 * p + 1]]);
			g.drawPolygon(poly);
		}
	}, [triangles, vertices]);

	const pointTexture = Texture.from(dotTexture);
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
				appearanceContainer={ appearanceContainer }
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
								anchor={ [0.5, 0.5] }
								scale={ [0.5, 0.5] }
								alpha={ 0.5 }
								position={ p }
							/>
						)) }
					</Container>
				)
			}
		</>
	);
}
