import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Application, Filter, IApplicationOptions, Texture } from 'pixi.js';
import { Sprite, Stage } from '@saitonakamura/react-pixi';
import { ChildrenProps } from '../common/reactTypes';
import { useEvent } from '../common/useEvent';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback } from './pixiViewport';
import { Assert, AssertNever, CharacterSize } from 'pandora-common';

export type GraphicsSceneProps = {
	viewportConfig?: PixiViewportSetupCallback;
	viewportRef?: Ref<PixiViewportRef>;
	worldWidth?: number;
	worldHeight?: number;
	background?: string | number;
	backgroundSize?: [number, number];
	backgroundFilters?: Filter[] | null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	forwardContexts?: readonly Context<any>[];
};

const DEFAULT_BACKGROUND_COLOR = 0x1099bb;

function ContextBridge({ children, contexts, render }: {
	children: ReactNode;
	contexts: readonly Context<unknown>[];
	render: (children: ReactNode) => ReactNode;
}): ReactElement {
	if (contexts.length === 0) {
		return <>{ render(children) }</>;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const Ctx = contexts[0];

	return (
		<Ctx.Consumer>
			{ (value) => (
				<ContextBridge contexts={ contexts.slice(1) } render={ render }>
					<Ctx.Provider value={ value }>
						{children}
					</Ctx.Provider>
				</ContextBridge>
			) }
		</Ctx.Consumer>
	);
}

function GraphicsSceneCore({
	children,
	div,
	viewportConfig,
	viewportRef,
	worldWidth,
	worldHeight,
	background,
	backgroundSize,
	backgroundFilters,
	forwardContexts = [],
}: ChildrenProps & GraphicsSceneProps & {
	div: HTMLDivElement;
}): ReactElement {
	const appRef = useRef<Application | null>(null);

	const options = useMemo<IApplicationOptions>(() => ({
		backgroundColor: 0x1099bb,
		resolution: window.devicePixelRatio || 1,
		// Antialias **NEEDS** to be explicitely disabled - having it enabled causes seams when using filters (such as alpha masks)
		antialias: false,
		resizeTo: div,
	}), [div]);

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

	const backgroundResult = useMemo<{
		backgroundColor: number;
		backgroundAlpha: number;
		backgroundImage: string;
	}>(() => {
		if (typeof background === 'number') {
			return {
				backgroundColor: background,
				backgroundAlpha: 1,
				backgroundImage: '',
			};
		}
		if (!background) {
			return {
				backgroundColor: DEFAULT_BACKGROUND_COLOR,
				backgroundAlpha: 1,
				backgroundImage: '',
			};
		}
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(background)) {
			return {
				backgroundColor: parseInt(background.substring(1, 7), 16),
				backgroundAlpha: background.length > 7 ? (parseInt(background.substring(7, 9), 16) / 255) : 1,
				backgroundImage: '',
			};
		} else if (/^data:image\/png;base64,[0-9a-zA-Z+/=]+$/i.test(background) || /^https?:\/\/.+$/i.test(background)) {
			return {
				backgroundColor: 0x000000,
				backgroundAlpha: 1,
				backgroundImage: background,
			};
		}
		Assert(false, `Invalid background: ${background}`);
	}, [background]);

	const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);

	const wantedBackground = useRef<string>('');
	useEffect(() => {
		const app = appRef.current;
		if (!app)
			return;
		app.renderer.backgroundColor = backgroundResult.backgroundColor;
		app.renderer.backgroundAlpha = backgroundResult.backgroundAlpha;
		wantedBackground.current = backgroundResult.backgroundImage;
		if (!backgroundResult.backgroundImage) {
			setBackgroundTexture(null);
		} else if (/^data:image\/png;base64,[0-9a-zA-Z+/=]+$/i.test(backgroundResult.backgroundImage)) {
			const img = new Image();
			img.src = backgroundResult.backgroundImage;
			setBackgroundTexture(Texture.from(img));
		} else if (/^https?:\/\/.+$/i.test(backgroundResult.backgroundImage)) {
			(async () => {
				const texture = await Texture.fromURL(backgroundResult.backgroundImage);
				if (wantedBackground.current === backgroundResult.backgroundImage) {
					setBackgroundTexture(texture);
				}
			})().catch(() => { /** */ });
		} else {
			AssertNever();
		}
	}, [backgroundResult]);

	const onMount = useCallback((newApp: Application) => {
		appRef.current = newApp;
	}, []);
	const onUnmount = useCallback((_oldApp: Application) => {
		appRef.current = null;
	}, []);

	return (
		<ContextBridge contexts={ forwardContexts } render={ (c) => (
			<Stage
				onMount={ onMount }
				onUnmount={ onUnmount }
				options={ options }
				raf={ false }
				renderOnComponentChange={ true }
			>
				{ c }
			</Stage>
		) }>
			<React.StrictMode>
				<PixiViewport
					{ ...size }
					worldWidth={ worldWidth ?? CharacterSize.WIDTH }
					worldHeight={ worldHeight ?? CharacterSize.HEIGHT }
					setup={ viewportSetup }
					ref={ viewportRef }
					sortableChildren
				>
					{ children }
					{
						!backgroundTexture ? null : (
							<Sprite
								zIndex={ -1000 }
								texture={ backgroundTexture }
								width={ backgroundSize?.[0] }
								height={ backgroundSize?.[1] }
								filters={ backgroundFilters ?? null }
							/>
						)
					}
				</PixiViewport>
			</React.StrictMode>
		</ContextBridge>
	);
}
export function GraphicsScene({
	children,
	sceneOptions,
	divChildren,
	...divProps
}: {
	sceneOptions?: GraphicsSceneProps;
	divChildren?: ReactNode;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>): ReactElement {

	const [div, setDiv] = useState<HTMLDivElement | null>(null);

	return (
		<div { ...divProps } ref={ setDiv }>
			{
				div ? (
					<GraphicsSceneCore { ...sceneOptions } div={ div }>
						{ children }
					</GraphicsSceneCore>
				) : null
			}
			{ divChildren }
		</div>
	);
}
