import { Sprite } from '@pixi/react';
import classNames from 'classnames';
import { CharacterSize } from 'pandora-common';
import { Application, Filter } from 'pixi.js';
import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImageResolutionAlternative } from '../assets/assetGraphics';
import { ChildrenProps } from '../common/reactTypes';
import { useEvent } from '../common/useEvent';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary';
import { GraphicsSceneRendererDirect, GraphicsSceneRendererShared } from './graphicsSceneRenderer';
import { useGraphicsSettings } from './graphicsSettings';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback } from './pixiViewport';
import { useTexture } from './useTexture';

export type GraphicsSceneProps = {
	viewportConfig?: PixiViewportSetupCallback;
	viewportRef?: Ref<PixiViewportRef>;
	worldWidth?: number;
	worldHeight?: number;
	backgroundColor?: number;
	backgroundAlpha?: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	forwardContexts?: readonly Context<any>[];

	/** If this scene should create private (non-shared) pixi instance. Impacts performance! */
	createPrivatePixiInstance?: boolean;
};

export const DEFAULT_BACKGROUND_COLOR = 0xaaaaaa;

function GraphicsSceneCore({
	children,
	div,
	resolution,
	viewportConfig,
	viewportRef,
	worldWidth,
	worldHeight,
	backgroundColor = DEFAULT_BACKGROUND_COLOR,
	backgroundAlpha = 1,
	forwardContexts = [],
	createPrivatePixiInstance,
}: ChildrenProps & GraphicsSceneProps & {
	div: HTMLDivElement;
	resolution: number;
}): ReactElement {
	const appRef = useRef<Application | null>(null);

	const [size, setSize] = useState({ width: 1, height: 1 });

	const onResize = useEvent(() => {
		const app = appRef.current;
		if (!app)
			return;
		app.resize();
		const { width, height } = app.screen;
		setSize({ width, height });
	});

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
		const app = appRef.current;
		if (app) {
			app.resizeTo = div;
			onResize();
		}
		resizeObserver.observe(div);
		return () => {
			resizeObserver.unobserve(div);
		};
	}, [div, resizeObserver, onResize]);

	useEffect(() => {
		const app = appRef.current;
		if (!app)
			return;

		const renderer = app.renderer;
		renderer.background.color = backgroundColor;
		renderer.background.alpha = backgroundAlpha;
		renderer.render(app.stage);
	}, [backgroundColor, backgroundAlpha]);

	const onMount = useCallback((newApp: Application) => {
		appRef.current = newApp;
	}, []);
	const onUnmount = useCallback((_oldApp: Application) => {
		appRef.current = null;
	}, []);

	const PixiRenderer = createPrivatePixiInstance ? GraphicsSceneRendererDirect : GraphicsSceneRendererShared;

	return (
		<PixiRenderer
			container={ div }
			forwardContexts={ forwardContexts }
			onMount={ onMount }
			onUnmount={ onUnmount }
			resolution={ resolution }
		>
			<PixiViewport
				{ ...size }
				worldWidth={ worldWidth ?? CharacterSize.WIDTH }
				worldHeight={ worldHeight ?? CharacterSize.HEIGHT }
				setup={ viewportSetup }
				ref={ viewportRef }
				sortableChildren
			>
				{ children }
			</PixiViewport>
		</PixiRenderer>
	);
}

export function GraphicsBackground({
	background,
	backgroundSize,
	backgroundFilters,
	zIndex,
	x,
	y,
}: {
	background?: string | number;
	backgroundSize?: readonly [number, number];
	backgroundFilters?: Filter[] | null;
	zIndex?: number;
	x?: number;
	y?: number;
}): ReactElement | null {
	const backgroundResult = useMemo<{
		backgroundTint: number;
		backgroundAlpha: number;
		backgroundImage: string;
	}>(() => {
		// Number is color in pixi format
		if (typeof background === 'number') {
			return {
				backgroundTint: background,
				backgroundAlpha: 1,
				backgroundImage: '*',
			};
		}
		// If background is not defined, use default one
		if (!background) {
			return {
				backgroundTint: DEFAULT_BACKGROUND_COLOR,
				backgroundAlpha: 1,
				backgroundImage: '*',
			};
		}
		// Parse color in hex format, with optional alpha
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(background)) {
			return {
				backgroundTint: parseInt(background.substring(1, 7), 16),
				backgroundAlpha: background.length > 7 ? (parseInt(background.substring(7, 9), 16) / 255) : 1,
				backgroundImage: '*',
			};
		}
		// Otherwise try to use background as image path
		return {
			backgroundTint: 0xffffff,
			backgroundAlpha: 1,
			backgroundImage: background,
		};
	}, [background]);

	const backgroundTexture = useTexture(useImageResolutionAlternative(backgroundResult.backgroundImage).image, true);

	return (
		<Sprite
			x={ x ?? 0 }
			y={ y ?? 0 }
			width={ backgroundSize?.[0] }
			height={ backgroundSize?.[1] }
			zIndex={ zIndex }
			texture={ backgroundTexture }
			tint={ backgroundResult.backgroundTint }
			filters={ backgroundFilters ?? null }
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
