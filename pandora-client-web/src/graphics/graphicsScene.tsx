import React, { Context, ReactElement, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Application, Filter, Renderer, Texture } from 'pixi.js';
import { Sprite } from '@pixi/react';
import { ChildrenProps } from '../common/reactTypes';
import { useEvent } from '../common/useEvent';
import { PixiViewport, PixiViewportRef, PixiViewportSetupCallback } from './pixiViewport';
import { Assert, AssertNever, CharacterSize } from 'pandora-common';
import { GraphicsSceneRendererDirect, GraphicsSceneRendererShared } from './graphicsSceneRenderer';
import classNames from 'classnames';
import { useGraphicsSettings } from './graphicsSettings';

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

	/** If this scene should create private (non-shared) pixi instance. Impacts performance! */
	createPrivatePixiInstance?: boolean;
};

const DEFAULT_BACKGROUND_COLOR = 0xaaaaaa;

function GraphicsSceneCore({
	children,
	div,
	resolution,
	viewportConfig,
	viewportRef,
	worldWidth,
	worldHeight,
	background,
	backgroundSize,
	backgroundFilters,
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

		const renderer = app.renderer as Renderer;
		renderer.background.color = backgroundResult.backgroundColor;
		renderer.background.alpha = backgroundResult.backgroundAlpha;
		renderer.render(app.stage);
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

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const Renderer = createPrivatePixiInstance ? GraphicsSceneRendererDirect : GraphicsSceneRendererShared;

	return (
		<Renderer
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
		</Renderer>
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

	const { resolution } = useGraphicsSettings();

	const [div, setDiv] = useState<HTMLDivElement | null>(null);

	return (
		<div className={ classNames({ disabled: resolution <= 0 }, className) } { ...divProps } ref={ setDiv }>
			{
				div && resolution > 0 ? (
					<GraphicsSceneCore { ...sceneOptions } div={ div } resolution={ resolution / 100 }>
						{ children }
					</GraphicsSceneCore>
				) : null
			}
			{ divChildren }
		</div>
	);
}
