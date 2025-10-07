import type { Immutable } from 'immer';
import { AssertNever, AssetFrameworkCharacterState, IsNotNullable, LayerMirror, MirrorBoneLike, type Item, type LayerImageSetting, type Rectangle, type WearableAssetType } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Texture } from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { SCALING_IMAGE_UV_EMPTY, useLayerImageSource, useLayerMeshPoints } from '../../../assets/assetGraphicsCalculations.ts';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { Sprite } from '../../../graphics/baseComponents/sprite.ts';
import { useItemColor, useLayerVertices, type GraphicsLayerProps } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { usePixiApp } from '../../../graphics/reconciler/appContext.ts';
import { GetTextureBoundingBox } from '../../../graphics/utility/textureBoundingBox.ts';
import { useObservable } from '../../../observable.ts';
import { useEditorPointTemplates } from '../../assets/editorAssetGraphicsManager.ts';
import type { EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphics } from '../../assets/graphics/editorAssetGraphics.ts';
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
	characterState,
	...props
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: EditorAssetGraphicsWornLayer;
}): ReactElement | null {
	const item = characterState.items.find((i) => (
		i.asset.id === layer.assetGraphics.id ||
		i.isType('roomDeviceWearablePart') && i.roomDevice?.asset.id === layer.assetGraphics.id
	)) ?? null;

	switch (layer.type) {
		case 'mesh':
			return <SetupMeshLayerSelected { ...props } layer={ layer } characterState={ characterState } item={ item } />;
		case 'alphaImageMesh':
			return <SetupAlphaImageMeshLayerSelected { ...props } layer={ layer } characterState={ characterState } item={ item } />;
		case 'autoMesh':
			return <SetupAutomeshLayerSelected { ...props } layer={ layer } characterState={ characterState } item={ item } />;
		case 'text':
			return <SetupTextLayerSelected { ...props } layer={ layer } characterState={ characterState } />;
	}
	AssertNever(layer);
}

export function SetupMeshLayerSelected({
	characterState,
	item,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	item: Item<WearableAssetType> | null;
	zIndex: number;
	layer: EditorAssetGraphicsWornLayer<'mesh'>;
}): ReactElement {
	const state = useEditorLayerStateOverride(layer);

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
	const uv = useLayerVertices(evaluatorUvPose, points, definition, item, true).vertices;

	const asset = layer.assetGraphics;
	const editorAssetTextures = useObservable(asset.textures);

	const editorGetTexture = useMemo<((image: string) => Texture)>(() => {
		return (i) => (editorAssetTextures.get(i) ?? Texture.EMPTY);
	}, [editorAssetTextures]);

	const texture = !image ? Texture.EMPTY : editorGetTexture(image);

	const { color, alpha } = useItemColor(characterState.items, item, colorizationKey, state);

	const images = useMemo((): readonly string[] => {
		const imagesTmp = new Set<string>();

		function listImageSettingImages(setting: Immutable<LayerImageSetting>) {
			setting.overrides.forEach(({ image: i }) => {
				if (i) {
					imagesTmp.add(i);
				}
			});

			if (setting.image) {
				imagesTmp.add(setting.image);
			}
		}

		listImageSettingImages(definition.image);
		definition.scaling?.stops.forEach((stop) => listImageSettingImages(stop[1]));

		return Array.from(imagesTmp);
	}, [definition]);

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
			<ImageArea
				images={ images }
				area={ definition }
				asset={ asset }
			/>
		</Container>
	);
}

export function SetupAlphaImageMeshLayerSelected({
	characterState,
	item,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	item: Item<WearableAssetType> | null;
	zIndex: number;
	layer: EditorAssetGraphicsWornLayer<'alphaImageMesh'>;
}): ReactElement {
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
	const uv = useLayerVertices(evaluatorUvPose, points, definition, item, true).vertices;

	const images = useMemo((): readonly string[] => {
		const imagesTmp = new Set<string>();

		function listImageSettingImages(setting: Immutable<LayerImageSetting>) {
			setting.overrides.forEach(({ image: i }) => {
				if (i) {
					imagesTmp.add(i);
				}
			});

			if (setting.image) {
				imagesTmp.add(setting.image);
			}
		}

		listImageSettingImages(definition.image);
		definition.scaling?.stops.forEach((stop) => listImageSettingImages(stop[1]));

		return Array.from(imagesTmp);
	}, [definition]);

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

	const asset = layer.assetGraphics;
	const editorAssetTextures = useObservable(asset.textures);

	const editorGetTexture = useMemo<((image: string) => Texture)>(() => {
		return (i) => (editorAssetTextures.get(i) ?? Texture.EMPTY);
	}, [editorAssetTextures]);

	const texture = !image ? Texture.EMPTY : editorGetTexture(image);

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
			<ImageArea
				images={ images }
				area={ definition }
				asset={ asset }
			/>
		</Container>
	);
}

export function SetupAutomeshLayerSelected({
	characterState,
	item,
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	item: Item<WearableAssetType> | null;
	zIndex: number;
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
}): ReactElement {
	const definition = useObservable(layer.definition);
	const {
		height,
		width,
		x, y,
		imageMap,
	} = definition;

	const template = useEditorPointTemplates().get(definition.points);
	const pointType = useMemo((): readonly string[] => (
		Array.from(new Set(
			template
				?.automeshTemplates
				?.[definition.automeshTemplate]
				?.parts
				.filter((p) => definition.disabledTemplateParts == null || !definition.disabledTemplateParts.includes(p.id))
				.flatMap((p) => [
					p.pointType,
					p.mirror !== LayerMirror.NONE ? p.pointType?.map(MirrorBoneLike) : undefined,
				])
				.filter(IsNotNullable)
				.flat(),
		))
	), [definition.automeshTemplate, definition.disabledTemplateParts, template?.automeshTemplates]);

	const { points, triangles } = useLayerMeshPoints({
		points: definition.points,
		pointType,
	});

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, false, SCALING_IMAGE_UV_EMPTY);
	const uv = useLayerVertices(evaluatorUvPose, points, definition, item, true).vertices;

	const images = useMemo((): readonly string[] => {
		const imagesTmp = new Set<string>();

		for (const mapped of Object.values(imageMap)) {
			for (const i of mapped) {
				if (i) {
					imagesTmp.add(i);
				}
			}
		}

		return Array.from(imagesTmp);
	}, [imageMap]);

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

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<Graphics
				zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
				draw={ drawWireFrame }
			/>
			<ImageArea
				images={ images }
				area={ definition }
				asset={ layer.assetGraphics }
			/>
		</Container>
	);
}

export function SetupTextLayerSelected({
	zIndex,
	layer,
}: {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	layer: EditorAssetGraphicsWornLayer<'text'>;
}): ReactElement {

	const definition = useObservable(layer.definition);
	const {
		height,
		width,
		x, y,
		angle,
	} = definition;

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Borders of the layer
		g.rect(0, 0, width, height)
			.stroke({ width: 2, color: 0x000088, alpha: 0.6, pixelLine: true });

	}, [width, height]);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<Graphics
				position={ { x, y } }
				angle={ angle }
				zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
				draw={ drawWireFrame }
			/>
		</Container>
	);
}

function ImageArea({
	images,
	area,
	asset,
}: {
	images: readonly string[];
	area: Immutable<Rectangle>;
	asset: EditorAssetGraphics;
}): ReactElement {
	const app = usePixiApp();

	const editorAssetTextures = useObservable(asset.textures);

	const imageBoundingBox = useMemo((): Rectangle | null => {
		const textures = images.map((i) => editorAssetTextures.get(i));
		if (textures.length === 0)
			return null;

		const imageBoundingBoxTmp = [1, 1, 0, 0]; // left, top, rightExclusive, bottomExclusive
		for (const t of textures) {
			if (t == null)
				return null;

			const box = GetTextureBoundingBox(t, app);
			if (box.width === 0 || box.height === 0)
				continue;
			imageBoundingBoxTmp[0] = Math.min(imageBoundingBoxTmp[0], box.left / box.width);
			imageBoundingBoxTmp[1] = Math.min(imageBoundingBoxTmp[1], box.top / box.height);
			imageBoundingBoxTmp[2] = Math.max(imageBoundingBoxTmp[2], box.rightExclusive / box.width);
			imageBoundingBoxTmp[3] = Math.max(imageBoundingBoxTmp[3], box.bottomExclusive / box.height);
		}
		const x1 = Math.floor(area.x + imageBoundingBoxTmp[0] * area.width);
		const y1 = Math.floor(area.y + imageBoundingBoxTmp[1] * area.height);
		const x2 = Math.ceil(area.x + imageBoundingBoxTmp[2] * area.width);
		const y2 = Math.ceil(area.y + imageBoundingBoxTmp[3] * area.height);
		return {
			x: x1,
			y: y1,
			width: x2 - x1,
			height: y2 - y1,
		};
	}, [app, area, images, editorAssetTextures]);

	const drawImageArea = useCallback((g: PIXI.GraphicsContext) => {
		if (imageBoundingBox != null) {
			g
				.rect(imageBoundingBox.x - 1, imageBoundingBox.y - 1, imageBoundingBox.width + 2, imageBoundingBox.height + 2)
				.stroke({ width: 1, color: 0x44ff44, alpha: 0.8, pixelLine: true });
		}
	}, [imageBoundingBox]);

	return (
		<Graphics
			zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
			draw={ drawImageArea }
		/>
	);
}
