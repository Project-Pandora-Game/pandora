import classNames from 'classnames';
import type { Immutable } from 'immer';
import { AssertNever, CharacterSize, GetRoomPositionBounds, type RoomBackground3dBoxSide, type RoomBackgroundData, type RoomBackgroundGraphics } from 'pandora-common';
import { Filter, type Application } from 'pixi.js';
import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImageResolutionAlternative } from '../assets/assetGraphicsCalculations.ts';
import { useAssetManager } from '../assets/assetManager.tsx';
import { ChildrenProps } from '../common/reactTypes.ts';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { Container } from './baseComponents/container.ts';
import { PixiMesh } from './baseComponents/mesh.tsx';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback, type PixiViewportProps } from './baseComponents/pixiViewport.tsx';
import { Sprite } from './baseComponents/sprite.ts';
import { GraphicsSceneRendererShared } from './graphicsSceneRenderer.tsx';
import { useGraphicsSettings } from './graphicsSettings.tsx';
import { useRoomViewProjection } from './room/roomScene.tsx';
import { useTexture } from './useTexture.ts';

export type GraphicsSceneProps = {
	viewportConfig?: PixiViewportSetupCallback;
	viewportOnMove?: PixiViewportProps['onMove'];
	viewportRef?: Ref<PixiViewportRef>;
	worldWidth?: number;
	worldHeight?: number;
	backgroundColor?: number;
	backgroundAlpha?: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	forwardContexts?: readonly Context<any>[];
	onMount?: (app: Application) => void;
	onUnmount?: (app: Application) => void;
};

export const DEFAULT_BACKGROUND_COLOR = 0xaaaaaa;

function GraphicsSceneCore({
	children,
	div,
	resolution,
	viewportConfig,
	viewportOnMove,
	viewportRef,
	worldWidth,
	worldHeight,
	backgroundColor = DEFAULT_BACKGROUND_COLOR,
	backgroundAlpha = 1,
	forwardContexts = [],
	onMount: onSceneMount,
	onUnmount: onSceneUnmount,
}: ChildrenProps & GraphicsSceneProps & {
	div: HTMLDivElement;
	resolution: number;
}): ReactElement {
	const appRef = useRef<Application | null>(null);

	const [size, setSize] = useState({ width: 1, height: 1 });

	const onResize = useCallback(() => {
		const app = appRef.current;
		if (!app)
			return;
		app.resize();
		const { width, height } = app.screen;
		setSize({ width, height });
	}, []);

	const viewportSetup = useCallback<PixiViewportSetupCallback>((viewport, params) => {
		viewport.clampZoom({
			minScale: Math.min(params.height / params.worldHeight, params.width / params.worldWidth) * 0.2,
			maxScale: 2,
		});
		viewport.pinch();
		viewport.fit();
		viewport.moveCenter(params.worldWidth / 2, params.worldHeight / 2);
		viewportConfig?.(viewport, params);
	}, [viewportConfig]);

	const resizeObserver = useMemo(() => new ResizeObserver(() => onResize()), [onResize]);
	useEffect(() => {
		return () => {
			resizeObserver.disconnect();
		};
	}, [resizeObserver]);

	useEffect(() => {
		resizeObserver.observe(div);
		return () => {
			resizeObserver.unobserve(div);
		};
	}, [div, resizeObserver]);

	const onMount = useCallback((newApp: Application) => {
		appRef.current = newApp;
		onResize();
		onSceneMount?.(newApp);
	}, [onResize, onSceneMount]);
	const onUnmount = useCallback((oldApp: Application) => {
		onSceneUnmount?.(oldApp);
		appRef.current = null;
	}, [onSceneUnmount]);

	return (
		<GraphicsSceneRendererShared
			container={ div }
			forwardContexts={ forwardContexts }
			onMount={ onMount }
			onUnmount={ onUnmount }
			resolution={ resolution }
			backgroundColor={ backgroundColor }
			backgroundAlpha={ backgroundAlpha }
		>
			<PixiViewport
				{ ...size }
				worldWidth={ worldWidth ?? CharacterSize.WIDTH }
				worldHeight={ worldHeight ?? CharacterSize.HEIGHT }
				setup={ viewportSetup }
				onMove={ viewportOnMove }
				ref={ viewportRef }
				sortableChildren
			>
				{ children }
			</PixiViewport>
		</GraphicsSceneRendererShared>
	);
}

export function GraphicsBackground({
	background,
	backgroundFilters,
	zIndex,
}: {
	background: Immutable<RoomBackgroundData>;
	backgroundFilters?: Filter[];
	zIndex?: number;
}): ReactElement | null {
	if (background.graphics.type === 'image') {
		return (
			<GraphicsBackgroundImage
				graphics={ background.graphics }
				backgroundSize={ background.imageSize }
				backgroundFilters={ backgroundFilters }
				zIndex={ zIndex }
			/>
		);
	} else if (background.graphics.type === '3dBox') {
		return (
			<GraphicsBackground3DBox
				graphics={ background.graphics }
				background={ background }
				backgroundFilters={ backgroundFilters }
				zIndex={ zIndex }
			/>
		);
	}

	AssertNever(background.graphics);
}

function GraphicsBackgroundImage({
	graphics,
	backgroundSize,
	backgroundFilters,
	zIndex,
}: {
	graphics: Immutable<Extract<RoomBackgroundGraphics, { type: 'image'; }>>;
	backgroundSize: readonly [number, number];
	backgroundFilters?: Filter[];
	zIndex?: number;
}): ReactElement | null {
	const backgroundResult = useMemo<{
		backgroundTint: number;
		backgroundAlpha: number;
		backgroundImage: string;
	}>(() => {
		// If background is not defined, use default one
		if (!graphics.image) {
			return {
				backgroundTint: DEFAULT_BACKGROUND_COLOR,
				backgroundAlpha: 1,
				backgroundImage: '*',
			};
		}
		// Parse color in hex format, with optional alpha
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(graphics.image)) {
			return {
				backgroundTint: parseInt(graphics.image.substring(1, 7), 16),
				backgroundAlpha: graphics.image.length > 7 ? (parseInt(graphics.image.substring(7, 9), 16) / 255) : 1,
				backgroundImage: '*',
			};
		}
		// Otherwise try to use background as image path
		return {
			backgroundTint: 0xffffff,
			backgroundAlpha: 1,
			backgroundImage: graphics.image,
		};
	}, [graphics]);

	const backgroundTexture = useTexture(useImageResolutionAlternative(backgroundResult.backgroundImage).image, true);

	return (
		<Sprite
			width={ backgroundSize[0] }
			height={ backgroundSize[1] }
			zIndex={ zIndex }
			texture={ backgroundTexture }
			tint={ backgroundResult.backgroundTint }
			filters={ backgroundFilters }
		/>
	);
}

type GraphicsBackground3DBoxPart = {
	vertices: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	data: RoomBackground3dBoxSide;
};
function GraphicsBackground3DBox({
	graphics,
	background,
	backgroundFilters,
	zIndex,
}: {
	graphics: Immutable<Extract<RoomBackgroundGraphics, { type: '3dBox'; }>>;
	background: Immutable<RoomBackgroundData>;
	backgroundFilters?: Filter[];
	zIndex?: number;
}): ReactElement | null {
	const projection = useRoomViewProjection(background);

	const parts = useMemo((): GraphicsBackground3DBoxPart[] => {
		// TODO: Generate tiles instead of stretching the texture like this
		const result: GraphicsBackground3DBoxPart[] = [];
		const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
		const indices = new Uint32Array([0, 1, 2, 2, 3, 0]);

		const { ceiling } = background;
		const { minX, maxX, minY, maxY } = GetRoomPositionBounds(background);

		result.push({
			vertices: new Float32Array([
				...projection.transform(minX, minY, 0),
				...projection.transform(maxX, minY, 0),
				...projection.transform(maxX, maxY, 0),
				...projection.transform(minX, maxY, 0),
			]),
			uvs,
			indices,
			data: graphics.floor,
		});

		result.push({
			vertices: new Float32Array([
				...projection.transform(minX, maxY, 0),
				...projection.transform(maxX, maxY, 0),
				...projection.transform(maxX, maxY, ceiling),
				...projection.transform(minX, maxY, ceiling),
			]),
			uvs,
			indices,
			data: graphics.wallBack,
		});

		if (graphics.wallLeft != null) {
			result.push({
				vertices: new Float32Array([
					...projection.transform(minX, minY, 0),
					...projection.transform(minX, maxY, 0),
					...projection.transform(minX, maxY, ceiling),
					...projection.transform(minX, minY, ceiling),
				]),
				uvs,
				indices,
				data: graphics.wallLeft,
			});
		}

		if (graphics.wallRight != null) {
			result.push({
				vertices: new Float32Array([
					...projection.transform(maxX, maxY, 0),
					...projection.transform(maxX, minY, 0),
					...projection.transform(maxX, minY, ceiling),
					...projection.transform(maxX, maxY, ceiling),
				]),
				uvs,
				indices,
				data: graphics.wallRight,
			});
		}

		if (graphics.ceiling != null) {
			result.push({
				vertices: new Float32Array([
					...projection.transform(minX, minY, ceiling),
					...projection.transform(maxX, minY, ceiling),
					...projection.transform(maxX, maxY, ceiling),
					...projection.transform(minX, maxY, ceiling),
				]),
				uvs,
				indices,
				data: graphics.ceiling,
			});
		}

		return result;
	}, [graphics, background, projection]);

	return (
		<Container zIndex={ zIndex } filters={ backgroundFilters }>
			{
				parts.map((p, i) => (
					<GraphicsBackground3DBoxSide
						key={ i }
						part={ p }
					/>
				))
			}
		</Container>
	);
}

function GraphicsBackground3DBoxSide({ part }: {
	part: GraphicsBackground3DBoxPart;
}) {
	const assetManager = useAssetManager();
	const tileInfo = (!!part.data.texture && part.data.texture !== '*') ? assetManager.tileTextures.get(part.data.texture) : undefined;

	const texture = useTexture(tileInfo?.image ?? '*');

	return (
		<PixiMesh
			texture={ texture }
			vertices={ part.vertices }
			uvs={ part.uvs }
			indices={ part.indices }
			tint={ parseInt(part.data.tint.substring(1, 7), 16) }
		/>
	);
}

export function GraphicsScene({
	children,
	sceneOptions,
	divChildren,
	className,
	...divProps
}: {
	className: string | undefined;
	sceneOptions?: GraphicsSceneProps;
	divChildren?: ReactNode;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>): ReactElement {
	const { renderResolution } = useGraphicsSettings();

	const [div, setDiv] = useState<HTMLDivElement | null>(null);

	return (
		<LocalErrorBoundary errorOverlayClassName={ className }>
			<div className={ classNames({ disabled: renderResolution <= 0 }, className) } { ...divProps } ref={ setDiv }>
				{
					div && renderResolution > 0 ? (
						<GraphicsSceneCore { ...sceneOptions } div={ div } resolution={ renderResolution / 100 }>
							{ children }
						</GraphicsSceneCore>
					) : null
				}
				{ divChildren }
			</div>
		</LocalErrorBoundary>
	);
}
