import classNames from 'classnames';
import { CharacterSize } from 'pandora-common';
import { type Application, Filter } from 'pixi.js';
import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImageResolutionAlternative } from '../assets/assetGraphicsCalculations.ts';
import { ChildrenProps } from '../common/reactTypes.ts';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback } from './baseComponents/pixiViewport.tsx';
import { Sprite } from './baseComponents/sprite.ts';
import { GraphicsSceneRendererShared } from './graphicsSceneRenderer.tsx';
import { useGraphicsSettings } from './graphicsSettings.tsx';
import { useTexture } from './useTexture.ts';

export type GraphicsSceneProps = {
	viewportConfig?: PixiViewportSetupCallback;
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
	backgroundSize,
	backgroundFilters,
	zIndex,
	x,
	y,
}: {
	background?: string | number;
	backgroundSize?: readonly [number, number];
	backgroundFilters?: Filter[];
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
			filters={ backgroundFilters }
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
