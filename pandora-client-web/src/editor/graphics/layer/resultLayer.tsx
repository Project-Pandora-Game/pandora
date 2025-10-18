import { isEqual } from 'lodash-es';
import { Assert, AssertNever } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { useLayerMeshPoints } from '../../../assets/assetGraphicsCalculations.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import type { GraphicsCharacterLayerBuilder } from '../../../graphics/graphicsCharacter.tsx';
import { GraphicsLayerAlphaImageMesh } from '../../../graphics/layers/graphicsLayerAlphaImageMesh.tsx';
import { useLayerVertices, type GraphicsLayerProps } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { GraphicsLayerMesh } from '../../../graphics/layers/graphicsLayerMesh.tsx';
import { GraphicsLayerText } from '../../../graphics/layers/graphicsLayerText.tsx';
import { MeshFaceIsCW } from '../../../graphics/utility.ts';
import { DotGraphics } from '../../../graphics/utility/dotGraphics.tsx';
import { useNullableObservable, useObservable } from '../../../observable.ts';
import { GetEditorSourceLayerForRuntimeLayer } from '../../assets/editorAssetCalculationHelpers.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA, EditorUseTextureGetterOverride } from './editorLayer.tsx';

export const EditorResultGraphicsCharacterLayerBuilder: GraphicsCharacterLayerBuilder = function (layer, previousLayers, reverse, characterState, characterBlinking, debugConfig) {
	switch (layer.layer.type) {
		case 'mesh': {
			previousLayers ??= [];
			const res = (
				<EditorGraphicsResultLayerMesh
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				/>
			);
			if (reverse) {
				previousLayers.unshift(res);
			} else {
				previousLayers.push(res);
			}
			return previousLayers;
		}
		case 'alphaImageMesh': {
			return [
				<EditorGraphicsResultLayerAlphaImageMesh
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				>
					{ previousLayers }
				</EditorGraphicsResultLayerAlphaImageMesh>,
			];
		}
		case 'text': {
			previousLayers ??= [];
			const res = (
				<EditorGraphicsResultLayerText
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				/>
			);
			if (reverse) {
				previousLayers.unshift(res);
			} else {
				previousLayers.push(res);
			}
			return previousLayers;
		}
	}
	AssertNever(layer.layer);
};

export function EditorGraphicsResultLayerMesh({
	layer,
	item,
	characterState,
	...props
}: GraphicsLayerProps<'mesh'>): ReactElement {
	const editor = useEditor();
	const editorLayer = GetEditorSourceLayerForRuntimeLayer(layer);
	const showHelpers = useObservable(editor.targetLayer) === editorLayer && editorLayer != null;

	const { points: pointTemplate, x, y, width, height } = layer;
	const { points, triangles } = useLayerMeshPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const vertices = useLayerVertices(evaluator, points, layer, item).vertices;

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Borders of the layer
		g.rect(x, y, width, height)
			.stroke({ width: 2, color: 0x000088, alpha: 0.6, pixelLine: true });

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
					.stroke({ width: 2, color: 0xff0000, alpha: 0.8, pixelLine: true });
			} else {
				g
					.stroke({ width: 1, color: 0x333333, alpha: 0.2, pixelLine: true });
			}
		}
	}, [triangles, vertices, x, y, width, height]);

	const editedTemplate = useObservable(editor.targetTemplate);
	const pointEditSelectedPoint = useNullableObservable(editedTemplate?.targetPoint);
	const displayPoints = useMemo<readonly [number, number][]>(() => {
		const res: [number, number][] = [];
		for (let i = 0; i < vertices.length; i += 2) {
			res.push([vertices[i], vertices[i + 1]]);
		}
		return res;
	}, [vertices]);

	return (
		<>
			<EditorUseTextureGetterOverride asset={ GetEditorSourceLayerForRuntimeLayer(layer)?.assetGraphics }>
				<GraphicsLayerMesh
					{ ...props }
					layer={ layer }
					item={ item }
					characterState={ characterState }
				/>
			</EditorUseTextureGetterOverride>
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
							<DotGraphics key={ i }
								tint={
									(editedTemplate?.templateName === pointTemplate && isEqual(pointEditSelectedPoint?.definition.value.index, points[i].index)) ?
									0xffff00 : 0xffffff
								}
								size={ 7 }
								position={ p }
								alpha={ 0.5 }
							/>
						)) }
					</Container>
				)
			}
		</>
	);
}

export function EditorGraphicsResultLayerAlphaImageMesh({
	layer,
	item,
	characterState,
	...props
}: GraphicsLayerProps<'alphaImageMesh'> & ChildrenProps): ReactElement {
	const editor = useEditor();
	const editorLayer = GetEditorSourceLayerForRuntimeLayer(layer);
	const showHelpers = useObservable(editor.targetLayer) === editorLayer && editorLayer != null;

	const { points: pointTemplate, x, y, width, height } = layer;
	const { points, triangles } = useLayerMeshPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const vertices = useLayerVertices(evaluator, points, layer, item).vertices;

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Borders of the layer
		g.rect(x, y, width, height)
			.stroke({ width: 2, color: 0x000088, alpha: 0.6, pixelLine: true });

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
					.stroke({ width: 2, color: 0xff0000, alpha: 0.8, pixelLine: true });
			} else {
				g
					.stroke({ width: 1, color: 0x333333, alpha: 0.2, pixelLine: true });
			}
		}
	}, [triangles, vertices, x, y, width, height]);

	const editedTemplate = useObservable(editor.targetTemplate);
	const pointEditSelectedPoint = useNullableObservable(editedTemplate?.targetPoint);
	const displayPoints = useMemo<readonly [number, number][]>(() => {
		const res: [number, number][] = [];
		for (let i = 0; i < vertices.length; i += 2) {
			res.push([vertices[i], vertices[i + 1]]);
		}
		return res;
	}, [vertices]);

	return (
		<>
			<EditorUseTextureGetterOverride asset={ GetEditorSourceLayerForRuntimeLayer(layer)?.assetGraphics }>
				<GraphicsLayerAlphaImageMesh
					{ ...props }
					layer={ layer }
					item={ item }
					characterState={ characterState }
				/>
			</EditorUseTextureGetterOverride>
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
							<DotGraphics key={ i }
								tint={
									(editedTemplate?.templateName === pointTemplate && isEqual(pointEditSelectedPoint?.definition.value.index, points[i].index)) ?
									0xffff00 : 0xffffff
								}
								size={ 7 }
								position={ p }
								alpha={ 0.5 }
							/>
						)) }
					</Container>
				)
			}
		</>
	);
}

function EditorGraphicsResultLayerText({
	layer,
	item,
	characterState,
	characterBlinking,
	...props
}: GraphicsLayerProps<'text'>): ReactElement {
	const editor = useEditor();
	const editorLayer = GetEditorSourceLayerForRuntimeLayer(layer);
	const showHelpers = useObservable(editor.targetLayer) === editorLayer && editorLayer != null;

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Borders of the layer
		g.rect(0, 0, layer.width, layer.height)
			.stroke({ width: 2, color: 0x000088, alpha: 0.6, pixelLine: true });

	}, [layer]);

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(characterState, currentlyBlinking);

	const position = useMemo(() => {
		const point = new PIXI.Point(layer.x, layer.y);
		if (layer.followBone != null) {
			evaluator.evalBoneTransform(layer.followBone).apply(point, point);
		}
		return point;
	}, [layer, evaluator]);

	return (
		<>
			<EditorUseTextureGetterOverride asset={ GetEditorSourceLayerForRuntimeLayer(layer)?.assetGraphics }>
				<GraphicsLayerText
					{ ...props }
					layer={ layer }
					item={ item }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
				/>
			</EditorUseTextureGetterOverride>
			{
				!showHelpers ? null : (
					<Graphics
						position={ position }
						angle={ (layer.followBone != null ? evaluator.evalBoneTransformAngle(layer.followBone) : 0) + layer.angle }
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
						draw={ drawWireFrame }
					/>
				)
			}
		</>
	);
}
