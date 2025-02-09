import { produce, type Immutable } from 'immer';
import {
	AppearanceItems,
	Assert,
	AssertNever,
	AssetFrameworkCharacterState,
	CharacterSize,
	HexColorString,
	Item,
	LayerMirror,
	Rectangle as PandoraRectangle,
	type LayerStateOverrides,
	type PointDefinitionCalculated,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Rectangle, Texture } from 'pixi.js';
import { ReactElement, createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AssetGraphicsLayer } from '../assets/assetGraphics';
import { useImageResolutionAlternative, useLayerDefinition, useLayerHasAlphaMasks, useLayerImageSource, useLayerMeshPoints } from '../assets/assetGraphicsCalculations';
import { ChildrenProps } from '../common/reactTypes';
import { useNullableObservable, useObservable, type ReadonlyObservable } from '../observable';
import { ConditionEvaluatorBase, useAppearanceConditionEvaluator } from './appearanceConditionEvaluator';
import { Container } from './baseComponents/container';
import { PixiMesh, type PixiMeshProps } from './baseComponents/mesh';
import { Sprite } from './baseComponents/sprite';
import { GraphicsMaskLayer } from './graphicsMaskLayer';
import { useGraphicsSettings } from './graphicsSettings';
import { usePixiApp, usePixiAppOptional } from './reconciler/appContext';
import { useTexture } from './useTexture';
import { EvaluateCondition } from './utility';

type TransformEvalCacheEntryValue = WeakMap<Immutable<PointDefinitionCalculated[]>, Float32Array>;
type TransformEvalCacheEntry = {
	noItem: TransformEvalCacheEntryValue;
	withItem: WeakMap<Item, TransformEvalCacheEntryValue>;
};

const transformEvalCache = new WeakMap<ConditionEvaluatorBase, TransformEvalCacheEntry>();

export function EvalLayerVerticesTransform(evaluator: ConditionEvaluatorBase, item: Item | null, points: Immutable<PointDefinitionCalculated[]>): Float32Array {
	let cacheEntry: TransformEvalCacheEntry | undefined = transformEvalCache.get(evaluator);
	if (cacheEntry === undefined) {
		cacheEntry = {
			noItem: new WeakMap(),
			withItem: new WeakMap(),
		};
		transformEvalCache.set(evaluator, cacheEntry);
	}

	let value: TransformEvalCacheEntryValue = cacheEntry.noItem;
	if (item != null) {
		let itemValue: TransformEvalCacheEntryValue | undefined = cacheEntry.withItem.get(item);
		if (itemValue === undefined) {
			itemValue = new WeakMap();
			cacheEntry.withItem.set(item, itemValue);
		}
		value = itemValue;
	}

	let result: Float32Array | undefined = value.get(points);
	if (result === undefined) {
		result = new Float32Array(points
			.flatMap((point) => evaluator.evalTransform(
				point.pos,
				point.transforms,
				point.mirror,
				item,
			)));
		value.set(points, result);
	}
	return result;
}

export function useLayerVertices(
	evaluator: ConditionEvaluatorBase,
	points: Immutable<PointDefinitionCalculated[]>,
	layer: AssetGraphicsLayer,
	item: Item | null,
	normalize: boolean = false,
): Float32Array {
	const layerDefinition = useLayerDefinition(layer);

	// Mirror
	const mirroredPoints = useMemo((): Immutable<PointDefinitionCalculated[]> => {
		if (layerDefinition.mirror === LayerMirror.FULL) {
			return produce(points, (draftPoints) => {
				for (const point of draftPoints) {
					// FIXME: This is likely wrong, but it isn't currently used anywhere (I kept old variant)
					point.pos[0] -= layerDefinition.width;
				}
			});
		}

		return points;
	}, [points, layerDefinition]);

	return useMemo((): Float32Array => {
		// Eval transform
		const result = EvalLayerVerticesTransform(evaluator, item, mirroredPoints);

		// Normalize
		if (normalize) {
			const normalizedResult = new Float32Array(result.length);
			for (let i = 0; i < result.length; i++) {
				const odd = (i % 2) !== 0;
				normalizedResult[i] = (result[i] - (odd ? layerDefinition.y : layerDefinition.x)) /
					(odd ? layerDefinition.height : layerDefinition.width);
			}
			return normalizedResult;
		}
		return result;
	}, [layerDefinition, evaluator, item, mirroredPoints, normalize]);
}

export interface GraphicsLayerProps extends ChildrenProps {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	lowerZIndex: number;
	layer: AssetGraphicsLayer;
	item: Item | null;

	/**
	 * Displays the vertices in pose matching the uv pose instead of the normal one.
	 * Useful for showing exact cutout of the original texture (which is useful in Editor).
	 * @default false
	 */
	displayUvPose?: boolean;
	state?: LayerStateOverrides;

	/**
	 * Observable for whether the character the layer belongs to is currently mid-blink.
	 * If not passed, it is assumed to be `false`.
	 */
	characterBlinking?: ReadonlyObservable<boolean>;

	getTexture?: (path: string) => Texture;
}

export const ContextCullClockwise = createContext<{
	cullClockwise: boolean;
	uniqueSwaps: readonly string[];
}>({ cullClockwise: false, uniqueSwaps: [] });

export function SwapCullingDirection({ children, swap = true, uniqueKey }: ChildrenProps & { swap?: boolean; uniqueKey?: string; }): ReactElement {
	const { cullClockwise, uniqueSwaps } = useContext(ContextCullClockwise);
	if (uniqueKey) {
		swap &&= !uniqueSwaps.includes(uniqueKey);
	}
	const newValue = useMemo(() => ({
		cullClockwise: swap ? !cullClockwise : cullClockwise,
		uniqueSwaps: (swap && uniqueKey) ? [...uniqueSwaps, uniqueKey] : uniqueSwaps,
	}), [cullClockwise, swap, uniqueKey, uniqueSwaps]);
	return (
		<ContextCullClockwise.Provider value={ newValue }>
			{ children }
		</ContextCullClockwise.Provider>
	);
}

export function SwapCullingDirectionObservable({ children, swap, uniqueKey }: ChildrenProps & { swap: ReadonlyObservable<boolean>; uniqueKey?: string; }): ReactElement {
	return (
		<SwapCullingDirection swap={ useObservable(swap) } uniqueKey={ uniqueKey }>
			{ children }
		</SwapCullingDirection>
	);
}

export function GraphicsLayer({
	characterState,
	children,
	zIndex,
	lowerZIndex,
	layer,
	item,
	displayUvPose = false,
	state,
	getTexture,
	characterBlinking,
}: GraphicsLayerProps): ReactElement {

	const { points, triangles } = useLayerMeshPoints(layer);

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(characterState, currentlyBlinking);

	const {
		colorizationKey,
	} = useLayerDefinition(layer);

	const {
		setting,
		image,
		imageUv,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, currentlyBlinking, imageUv);

	const vertices = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator, points, layer, item, false);
	const uv = useLayerVertices(evaluatorUvPose, points, layer, item, true);

	const alphaImage = useMemo<string>(() => {
		return setting.alphaOverrides?.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? setting.alphaImage ?? '';
	}, [evaluator, item, setting]);
	const alphaMesh = useMemo(() => ({
		vertices,
		uvs: uv,
		indices: triangles,
	}), [vertices, uv, triangles]);

	const texture = useTexture(useImageResolutionAlternative(image).image, undefined, getTexture);

	const { color, alpha } = useItemColor(characterState.items, item, colorizationKey, state);

	const hasAlphaMasks = useLayerHasAlphaMasks(layer);

	const { cullClockwise } = useContext(ContextCullClockwise);

	const cullingState = useMemo(() => {
		const pixiState = PIXI.State.for2d();
		pixiState.culling = true;
		// There is some strange thing in Pixi, that when things go through filter, they switch direction for some strange reason
		pixiState.clockwiseFrontFace = cullClockwise;
		return pixiState;
	}, [cullClockwise]);

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<PixiMesh
				state={ cullingState }
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

export function useItemColorString(items: AppearanceItems, item: Item | null, colorizationKey?: string | null): HexColorString | undefined {
	if (item == null || colorizationKey == null) {
		return undefined;
	} else if (item.isType('bodypart')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('personal')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('roomDevice')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('roomDeviceWearablePart')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('lock')) {
		return undefined;
	}
	AssertNever(item);
}

export function useItemColor(items: AppearanceItems, item: Item | null, colorizationKey?: string | null, state?: LayerStateOverrides): { color: number; alpha: number; } {
	let color = 0xffffff;
	let alpha = 1;
	const itemColor = useItemColorString(items, item, colorizationKey);
	if (itemColor) {
		color = Number.parseInt(itemColor.substring(1, 7), 16);
		if (itemColor.length > 7) {
			alpha = Number.parseInt(itemColor.substring(7, 9), 16) / 255;
		}
	}
	if (state) {
		color = state.color ?? color;
		alpha = state.alpha ?? alpha;
	}
	return { color, alpha };
}

export function useItemColorRibbon(items: AppearanceItems, item: Item | null): HexColorString | undefined {
	let color: HexColorString | undefined;

	if (item == null) {
		color = undefined;
	} else if (item.isType('bodypart')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('personal')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('roomDevice')) {
		color = item.getColorRibbon();
	} else if (item.isType('roomDeviceWearablePart')) {
		color = item.getColorRibbon();
	} else if (item.isType('lock')) {
		color = undefined;
	} else {
		AssertNever(item);
	}

	return (color?.substring(0, 7) as HexColorString | undefined);
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
	maskMesh?: Pick<PixiMeshProps, 'vertices' | 'uvs' | 'indices'>;
	zIndex?: number;
	getTexture?: (path: string) => Texture;
}

function MaskContainer({
	zIndex,
	children,
	...props
}: MaskContainerProps): ReactElement {
	const { alphamaskEngine } = useGraphicsSettings();
	// Rendering in background needs to create tree even without presence of pixi.js application, but masks require it
	const hasApp = usePixiAppOptional() != null;

	if (alphamaskEngine === 'pixi' && hasApp)
		return <MaskContainerPixi { ...props } zIndex={ zIndex }>{ children }</MaskContainerPixi>;

	if (alphamaskEngine === 'customShader' && hasApp)
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
	const app = usePixiApp();
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
			mask = new PIXI.MeshSimple({
				texture: alphaTexture,
				vertices: maskMesh.vertices,
				uvs: maskMesh.uvs,
				indices: maskMesh.indices,
			});
		} else {
			mask = new PIXI.Sprite(alphaTexture);
		}
		mask.x = MASK_SIZE.x;
		mask.y = MASK_SIZE.y;
		textureContainer.addChild(mask);

		// Render mask texture
		const bounds = new Rectangle(0, 0, MASK_SIZE.width, MASK_SIZE.height);
		const texture = app.renderer.generateTexture({
			target: textureContainer,
			resolution: 1,
			frame: bounds,
			textureSourceOptions: {
				scaleMode: 'nearest',
			},
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
				<SwapCullingDirection uniqueKey='filter'>
					{ children }
				</SwapCullingDirection>
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
	const app = usePixiApp();

	const maskLayer = useRef<GraphicsMaskLayer | null>(null);
	const maskContainer = useRef<PIXI.Container | null>(null);
	const maskGeometryFinal = useRef<PIXI.MeshGeometry | undefined | null>(null);

	const maskImageTexture = useTexture(maskImage, true, getTexture);
	const maskImageTextureSaved = useRef<PIXI.Texture | null>(null);

	const update = useCallback(() => {
		if (!maskContainer.current)
			return;
		if (maskLayer.current !== null) {
			maskContainer.current.filters = [maskLayer.current.filter];
		} else {
			maskContainer.current.filters = [];
		}
	}, []);

	useLayoutEffect(() => {
		maskImageTextureSaved.current = maskImageTexture;
		maskLayer.current?.updateContent(maskImageTexture);
		return () => {
			maskImageTextureSaved.current = null;
		};
	}, [maskImageTexture]);

	useLayoutEffect(() => {
		const g = maskGeometryFinal.current = maskMesh ? new PIXI.MeshGeometry({
			positions: maskMesh.vertices,
			uvs: maskMesh.uvs,
			indices: maskMesh.indices,
		}) : undefined;
		maskLayer.current?.updateGeometry(g);
		return () => {
			maskLayer.current?.updateGeometry(undefined);
			maskGeometryFinal.current?.destroy();
			maskGeometryFinal.current = null;
		};
	}, [maskMesh]);

	const [maskSprite, setMaskSprite] = useState<PIXI.Sprite | null>(null);

	useLayoutEffect(() => {
		if (!maskSprite)
			return;
		Assert(maskLayer.current == null);

		const engine = new GraphicsMaskLayer(app, maskSprite, MASK_SIZE);
		maskLayer.current = engine;
		if (maskGeometryFinal.current !== null) {
			engine.updateGeometry(maskGeometryFinal.current);
		}
		if (maskImageTextureSaved.current != null) {
			engine.updateContent(maskImageTextureSaved.current);
		}
		update();
		return () => {
			maskLayer.current = null;
			update();
			engine.destroy();
		};
	}, [app, maskSprite, update]);

	const setMaskContainer = useCallback((container: PIXI.Container | null) => {
		maskContainer.current = container;
		update();
	}, [update]);

	return (
		<>
			<Container ref={ setMaskContainer } zIndex={ zIndex }>
				<SwapCullingDirection uniqueKey='filter'>
					{ children }
				</SwapCullingDirection>
			</Container>
			<Sprite texture={ Texture.WHITE } ref={ setMaskSprite } renderable={ false } x={ -MASK_SIZE.x } y={ -MASK_SIZE.y } />
		</>
	);
}
