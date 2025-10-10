import {
	Assert,
	CharacterSize,
	Rectangle as PandoraRectangle,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { Rectangle, Texture } from 'pixi.js';
import { ReactElement, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLayerImageSource, useLayerMeshPoints } from '../../assets/assetGraphicsCalculations.ts';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { type PixiMeshProps } from '../baseComponents/mesh.tsx';
import { Sprite } from '../baseComponents/sprite.ts';
import { GraphicsMaskLayer } from '../graphicsMaskLayer.ts';
import { useGraphicsSettings } from '../graphicsSettings.tsx';
import { usePixiApp, usePixiAppOptional } from '../reconciler/appContext.ts';
import { useTexture } from '../useTexture.ts';
import { useLayerVertices, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';

export function GraphicsLayerAlphaImageMesh({
	characterState,
	children,
	zIndex,
	layer,
	item,
	displayUvPose = false,
	characterBlinking,
}: GraphicsLayerProps<'alphaImageMesh'>): ReactElement {

	const { points, triangles } = useLayerMeshPoints(layer);

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(characterState, currentlyBlinking);

	const {
		image,
		imageUv,
	} = useLayerImageSource(evaluator, layer, item);

	const evaluatorUvPose = useAppearanceConditionEvaluator(characterState, currentlyBlinking, imageUv);

	const vertices = useLayerVertices(displayUvPose ? evaluatorUvPose : evaluator, points, layer, item, false).vertices;
	const uv = useLayerVertices(evaluatorUvPose, points, layer, item, true).vertices;

	const alphaImage = image;
	const alphaMesh = useMemo(() => ({
		vertices,
		uvs: uv,
		indices: triangles,
	}), [vertices, uv, triangles]);

	return (
		<MaskContainer maskImage={ alphaImage } maskMesh={ alphaMesh } zIndex={ zIndex }>
			{ children }
		</MaskContainer>
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
	maskMesh?: Pick<PixiMeshProps, 'vertices' | 'uvs' | 'indices'>;
	zIndex?: number;
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
}: MaskContainerProps): ReactElement {
	const app = usePixiApp();
	const alphaTexture = useTexture(maskImage, true);

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
}: MaskContainerProps): ReactElement {
	const app = usePixiApp();

	const maskLayer = useRef<GraphicsMaskLayer | null>(null);
	const maskContainer = useRef<PIXI.Container | null>(null);
	const maskGeometryFinal = useRef<PIXI.MeshGeometry | undefined | null>(null);

	const maskImageTexture = useTexture(maskImage, true);
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
				{ children }
			</Container>
			<Sprite texture={ Texture.WHITE } ref={ setMaskSprite } renderable={ false } x={ -MASK_SIZE.x } y={ -MASK_SIZE.y } />
		</>
	);
}
