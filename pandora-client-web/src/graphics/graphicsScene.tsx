import classNames from 'classnames';
import { CharacterSize } from 'pandora-common';
import type { Application } from 'pixi.js';
import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChildrenProps } from '../common/reactTypes.ts';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { useDevicePixelRatio } from '../services/screenResolution/screenResolutionHooks.ts';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback, type PixiViewportProps } from './baseComponents/pixiViewport.tsx';
import { DEFAULT_BACKGROUND_COLOR } from './graphicsAppManager.ts';
import { GraphicsSceneRendererShared } from './graphicsSceneRenderer.tsx';
import { useGraphicsSettings, type GraphicsUpscalingSetting } from './graphicsSettings.tsx';

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

function GraphicsSceneCore({
	children,
	div,
	resolution,
	upscaling,
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
	upscaling?: GraphicsUpscalingSetting;
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
			upscaling={ upscaling }
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
			>
				{ children }
			</PixiViewport>
		</GraphicsSceneRendererShared>
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
	const { renderResolution, upscaling } = useGraphicsSettings();
	const dpr = useDevicePixelRatio();

	const [div, setDiv] = useState<HTMLDivElement | null>(null);

	return (
		<LocalErrorBoundary errorOverlayClassName={ className }>
			<div className={ classNames({ disabled: renderResolution <= 0 }, className) } { ...divProps } ref={ setDiv }>
				{
					div && renderResolution > 0 ? (
						<GraphicsSceneCore
							{ ...sceneOptions }
							div={ div }
							resolution={ (renderResolution / 100) * dpr }
							upscaling={ renderResolution === 100 ? undefined : upscaling }
						>
							{ children }
						</GraphicsSceneCore>
					) : null
				}
				{ divChildren }
			</div>
		</LocalErrorBoundary>
	);
}
