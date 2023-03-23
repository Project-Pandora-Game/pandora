import { Container, SimpleMesh, Sprite, useApp } from '@pixi/react';
import Delaunator from 'delaunator';
import { Immutable } from 'immer';
import { max, maxBy, min, minBy } from 'lodash';
import { nanoid } from 'nanoid';
import { BoneName, CharacterSize, CoordinatesCompressed, Item, LayerImageSetting, LayerMirror, PointDefinition, Rectangle as PandoraRectangle } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { IArrayBuffer, Rectangle, Texture } from 'pixi.js';
import React, { ReactElement, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AssetGraphicsLayer, PointDefinitionCalculated, useLayerCalculatedPoints, useLayerDefinition, useLayerHasAlphaMasks } from '../assets/assetGraphics';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { AppearanceContainer } from '../character/character';
import { ChildrenProps } from '../common/reactTypes';
import { useObservable } from '../observable';
import { AppearanceConditionEvaluator, useAppearanceConditionEvaluator } from './appearanceConditionEvaluator';
import { LayerStateOverrides } from './def';
import { GraphicsMaskLayer } from './graphicsMaskLayer';
import { useGraphicsSettings } from './graphicsSettings';
import { useTexture } from './useTexture';
import { EvaluateCondition } from './utility';

export function useLayerPoints(layer: AssetGraphicsLayer): {
	points: readonly PointDefinitionCalculated[];
	triangles: Uint32Array;
} {
	// Note: The points should NOT be filtered before Delaunator step!
	// Doing so would cause body and arms not to have exactly matching triangles,
	// causing (most likely) overlap, which would result in clipping.
	// In some other cases this could lead to gaps or other visual artifacts
	// Any optimization of unused points needs to be done *after* triangles are calculated
	const points = useLayerCalculatedPoints(layer);

	const { pointType } = useLayerDefinition(layer);
	const triangles = useMemo<Uint32Array>(() => {
		const result: number[] = [];
		const delaunator = new Delaunator(points.flatMap((point) => point.pos));
		for (let i = 0; i < delaunator.triangles.length; i += 3) {
			const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
			if (t.every((tp) => SelectPoints(points[tp], pointType))) {
				result.push(...t);
			}
		}
		return new Uint32Array(result);
	}, [pointType, points]);
	return { points, triangles };
}

export function SelectPoints({ pointType }: PointDefinition, pointTypes?: readonly string[]): boolean {
	// If point has no type, include it
	return !pointType ||
		// If there is no requirement on point types, include all
		!pointTypes ||
		// If the point type is included exactly, include it
		pointTypes.includes(pointType) ||
		// If the point type doesn't have side, include it if wanted types have sided one
		!pointType.match(/_[lr]$/) && (
			pointTypes.includes(pointType + '_r') ||
			pointTypes.includes(pointType + '_l')
		) ||
		// If the point type has side, indide it if wanted types have base one
		pointTypes.includes(pointType.replace(/_[lr]$/, ''));
}

export function MirrorPoint([x, y]: CoordinatesCompressed, mirror: LayerMirror, width: number): CoordinatesCompressed {
	if (mirror === LayerMirror.FULL)
		return [x - width, y];

	return [x, y];
}

export function useLayerVertices(
	evaluator: AppearanceConditionEvaluator,
	points: readonly PointDefinitionCalculated[],
	layer: AssetGraphicsLayer,
	item: Item | null,
	normalize: boolean = false,
	valueOverrides?: Record<BoneName, number>,
): Float32Array {
	const { mirror, height, width, x, y } = useLayerDefinition(layer);

	return useMemo(() => {
		const result = new Float32Array(points
			.flatMap((point) => evaluator.evalTransform(
				MirrorPoint(point.pos, mirror, width),
				point.transforms,
				point.mirror,
				item,
				valueOverrides,
			)));

		if (normalize) {
			for (let i = 0; i < result.length; i++) {
				result[i] -= i % 2 ? y : x;
				result[i] /= i % 2 ? height : width;
			}
		}
		return result;
	}, [evaluator, mirror, height, width, x, y, item, normalize, points, valueOverrides]);
}

export interface GraphicsLayerProps extends ChildrenProps {
	appearanceContainer: AppearanceContainer;
	zIndex: number;
	lowerZIndex: number;
	layer: AssetGraphicsLayer;
	item: Item | null;
	verticesPoseOverride?: Record<BoneName, number>;
	state?: LayerStateOverrides;
	getTexture?: (path: string) => Promise<Texture>;
}

export function GraphicsLayer({
	appearanceContainer,
	children,
	zIndex,
	lowerZIndex,
	layer,
	item,
	verticesPoseOverride,
	state,
	getTexture,
}: GraphicsLayerProps): ReactElement {

	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const vertices = useLayerVertices(evaluator, points, layer, item, false, verticesPoseOverride);

	const {
		image: scalingBaseimage,
		scaling,
		colorizationKey,
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

	const alphaImage = useMemo<string>(() => {
		return setting.alphaOverrides?.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? setting.alphaImage ?? '';
	}, [evaluator, item, setting]);
	const alphaMesh = useMemo(() => ({
		vertices,
		uvs: uv,
		indices: triangles,
	}), [vertices, uv, triangles]);

	const texture = useTexture(image, undefined, getTexture);

	const color: number = state?.color ??
		(
			(
				item != null &&
				colorizationKey != null &&
				item.color[colorizationKey]
			) ? Number.parseInt(item.color[colorizationKey].slice(1), 16) : undefined
		) ??
		0xffffff;

	const alpha = state?.alpha ?? 1;

	const hasAlphaMasks = useLayerHasAlphaMasks(layer);

	// Unfortunately `SimpleMesh` reuploads only vertices to GPU, meaning we need to recreate it whenever uvs or indices change
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const meshKey = useMemo(() => nanoid(), [uv, triangles]);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<SimpleMesh
				key={ meshKey }
				vertices={ vertices }
				uvs={ uv }
				indices={ triangles }
				texture={ texture }
				tint={ color }
				alpha={ alpha }
			/>
			{
				hasAlphaMasks ? (
					<MaskContainer maskImage={ alphaImage } maskMesh={ alphaMesh } zIndex={ lowerZIndex } getTexture={ getTexture }>
						{ children }
					</MaskContainer>
				) : (
					<Container zIndex={ lowerZIndex }>
						{ children }
					</Container>
				)
			}
		</Container>
	);
}

const MASK_X_OVERSCAN = 250;
export const MASK_SIZE: Readonly<PandoraRectangle> = {
	x: MASK_X_OVERSCAN,
	y: 0,
	width: CharacterSize.WIDTH + 2 * MASK_X_OVERSCAN,
	height: CharacterSize.HEIGHT,
};
interface MaskContainerProps extends ChildrenProps {
	maskImage: string;
	maskMesh?: {
		vertices: IArrayBuffer;
		uvs: IArrayBuffer;
		indices: IArrayBuffer;
	};
	zIndex?: number;
	getTexture?: (path: string) => Promise<Texture>;
}

function MaskContainer({
	zIndex,
	children,
	...props
}: MaskContainerProps): ReactElement {
	const { alphamaskEngine } = useGraphicsSettings();

	if (alphamaskEngine === 'pixi')
		return <MaskContainerPixi { ...props } zIndex={ zIndex }>{ children }</MaskContainerPixi>;

	if (alphamaskEngine === 'customShader')
		return <MaskContainerCustom { ...props } zIndex={ zIndex }>{ children }</MaskContainerCustom>;

	// Default - ignore masks
	return <Container zIndex={ zIndex }>{ children }</Container>;
}

function MaskContainerPixi({
	children,
	maskImage,
	maskMesh,
	zIndex,
	getTexture,
}: MaskContainerProps): ReactElement {
	const app = useApp();
	const alphaTexture = useTexture(maskImage, true, getTexture);

	const finalAlphaTexture = useRef<Texture | null>(null);
	const maskSprite = useRef<PIXI.Sprite | null>(null);
	const maskContainer = useRef<PIXI.Container | null>(null);

	const update = useCallback(() => {
		if (!maskSprite.current || !maskContainer.current)
			return;
		if (finalAlphaTexture.current !== null) {
			maskSprite.current.texture = finalAlphaTexture.current;
			maskSprite.current.visible = true;
			maskContainer.current.mask = maskSprite.current;
		} else {
			maskSprite.current.texture = Texture.WHITE;
			maskContainer.current.mask = null;
			maskSprite.current.visible = false;
		}
	}, []);

	useLayoutEffect(() => {
		if (alphaTexture === Texture.EMPTY)
			return undefined;
		// Create base for the mask
		const textureContainer = new PIXI.Container();
		const background = new PIXI.Sprite(Texture.WHITE);
		background.width = MASK_SIZE.width;
		background.height = MASK_SIZE.height;
		textureContainer.addChild(background);
		let mask: PIXI.Container;
		if (maskMesh) {
			mask = new PIXI.SimpleMesh(alphaTexture, maskMesh.vertices, maskMesh.uvs, maskMesh.indices);
		} else {
			mask = new PIXI.Sprite(alphaTexture);
		}
		mask.x = MASK_SIZE.x;
		mask.y = MASK_SIZE.y;
		textureContainer.addChild(mask);

		// Render mask texture
		const bounds = new Rectangle(0, 0, MASK_SIZE.width, MASK_SIZE.height);
		const texture = app.renderer.generateTexture(textureContainer, {
			resolution: 1,
			region: bounds,
			scaleMode: PIXI.SCALE_MODES.NEAREST,
			multisample: PIXI.MSAA_QUALITY.NONE,
		});
		finalAlphaTexture.current = texture;
		update();
		return () => {
			finalAlphaTexture.current = null;
			update();
			texture.destroy(true);
		};
	}, [maskMesh, alphaTexture, app, update]);

	const setMaskSprite = useCallback((sprite: PIXI.Sprite | null) => {
		maskSprite.current = sprite;
		update();
	}, [update]);
	const setMaskContainer = useCallback((container: PIXI.Container | null) => {
		maskContainer.current = container;
		update();
	}, [update]);

	return (
		<>
			<Container ref={ setMaskContainer } zIndex={ zIndex }>
				{ children }
			</Container>
			<Sprite texture={ Texture.WHITE } ref={ setMaskSprite } renderable={ false } x={ -MASK_SIZE.x } y={ -MASK_SIZE.y } />
		</>
	);
}

function MaskContainerCustom({
	children,
	maskImage,
	maskMesh,
	zIndex,
	getTexture,
}: MaskContainerProps): ReactElement {
	const app = useApp();
	const manager = useObservable(GraphicsManagerInstance);

	const maskLayer = useRef<GraphicsMaskLayer | null>(null);
	const maskContainer = useRef<PIXI.Container | null>(null);
	const maskImageFinal = useRef<string | null>(null);
	const maskGeometryFinal = useRef<PIXI.Geometry | undefined | null>(null);

	const update = useCallback(() => {
		if (!maskContainer.current)
			return;
		if (maskLayer.current !== null) {
			maskContainer.current.filters = [maskLayer.current.filter];
		} else {
			maskContainer.current.filters = null;
		}
	}, []);

	useLayoutEffect(() => {
		maskImageFinal.current = maskImage;
		maskLayer.current?.updateContent(maskImage);
	}, [maskImage]);

	useLayoutEffect(() => {
		const g = maskGeometryFinal.current = maskMesh ? new PIXI.MeshGeometry(maskMesh.vertices, maskMesh.uvs, maskMesh.indices) : undefined;
		maskLayer.current?.updateGeometry(g);
		return () => {
			maskGeometryFinal.current?.destroy();
			maskGeometryFinal.current = null;
		};
	}, [maskMesh]);

	const [maskSprite, setMaskSprite] = useState<PIXI.Sprite | null>(null);

	useLayoutEffect(() => {
		const getTextureFinal = getTexture ?? manager?.loader.getTexture.bind(manager.loader);
		if (!getTextureFinal || !maskSprite)
			return;

		const engine = new GraphicsMaskLayer(app.renderer, maskSprite, getTextureFinal, MASK_SIZE);
		maskLayer.current = engine;
		if (maskGeometryFinal.current !== null) {
			engine.updateGeometry(maskGeometryFinal.current);
		}
		if (maskImageFinal.current !== null) {
			engine.updateContent(maskImageFinal.current);
		}
		update();
		return () => {
			maskLayer.current = null;
			update();
			engine.destroy();
		};
	}, [app.renderer, getTexture, manager, maskSprite, update]);

	const setMaskContainer = useCallback((container: PIXI.Container | null) => {
		maskContainer.current = container;
		update();
	}, [update]);

	return (
		<>
			<Container ref={ setMaskContainer } zIndex={ zIndex }>
				{ children }
			</Container>
			<Sprite texture={ Texture.WHITE } ref={ setMaskSprite } renderable={ false } x={ -MASK_SIZE.x } y={ -MASK_SIZE.y } />
		</>
	);
}
