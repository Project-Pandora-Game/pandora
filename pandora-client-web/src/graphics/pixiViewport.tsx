import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { PixiComponent, useApp, useTick } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application, Point } from 'pixi.js';
import { ChildrenProps } from '../common/reactTypes';

export type PixiViewportSetupCallback = (viewport: Viewport, params: {
	width: number;
	height: number;
	worldWidth: number;
	worldHeight: number;
}) => void;

export interface PixiViewportProps extends ChildrenProps {
	width: number;
	height: number;
	worldWidth: number;
	worldHeight: number;
	sortableChildren?: boolean;
	setup?: PixiViewportSetupCallback;
}

const PixiViewportComponent = PixiComponent<PixiViewportProps & { app: Application; }, Viewport>('Viewport', {
	create(props) {
		const {
			app,
			width,
			height,
			worldWidth,
			worldHeight,
			sortableChildren,
			setup,
		} = props;

		const viewport = new Viewport({
			events: app.renderer.events,
			screenWidth: width,
			screenHeight: height,
			worldWidth,
			worldHeight,
			noTicker: true,
		});

		viewport.sortableChildren = sortableChildren === true;

		setup?.(viewport, {
			width,
			height,
			worldWidth,
			worldHeight,
		});

		return viewport;
	},
	applyProps(viewport, oldProps, newProps) {
		const {
			app: oldApp,
			width: oldWidth,
			height: oldHeight,
			worldWidth: oldWorldWidth,
			worldHeight: oldWorldHeight,
			setup: oldSetup,
		} = oldProps;
		const {
			app,
			width,
			height,
			worldWidth,
			worldHeight,
			sortableChildren,
			setup,
		} = newProps;

		if (app !== oldApp) {
			viewport.options.events = app.renderer.events;
		}

		viewport.sortableChildren = sortableChildren === true;

		if (
			width !== oldWidth ||
			height !== oldHeight ||
			worldWidth !== oldWorldWidth ||
			worldHeight !== oldWorldHeight
		) {
			viewport.resize(width, height, worldWidth, worldHeight);
			setup?.(viewport, {
				width,
				height,
				worldWidth,
				worldHeight,
			});
		} else if (setup !== oldSetup) {
			setup?.(viewport, {
				width,
				height,
				worldWidth,
				worldHeight,
			});
		}
	},
});

export type PixiViewportRef = {
	getCenter(): Point | undefined;
	center(): void;
};

export const PixiViewport = forwardRef<PixiViewportRef, PixiViewportProps>((props, ref) => {
	const [viewPort, setViewPort] = useState<Viewport | null>(null);
	const app = useApp();

	const [update, cancelUpdate] = useMemo(() => {
		let request: number | undefined;

		return [
			() => {
				if (request !== undefined)
					return;
				request = requestAnimationFrame(() => {
					request = undefined;
					app.ticker.update();
				});
			},
			() => {
				if (request !== undefined) {
					cancelAnimationFrame(request);
					request = undefined;
				}
			},
		];
	}, [app]);

	useImperativeHandle(ref, () => ({
		getCenter: () => viewPort?.center,
		center: () => {
			if (!viewPort)
				return;
			viewPort.fit();
			viewPort.moveCenter(viewPort.worldWidth / 2, viewPort.worldHeight / 2);
			update();
		},
	}), [update, viewPort]);

	useTick((_delta, ticker) => {
		viewPort?.update(ticker.elapsedMS);
	});

	useEffect(() => {
		if (!viewPort)
			return;

		const events = ['moved', 'zoomed'] as const;

		for (const e of events) {
			viewPort.on(e, update);
		}
		return () => {
			for (const e of events) {
				viewPort.off(e, update);
			}
			cancelUpdate();
		};
	}, [update, cancelUpdate, viewPort]);

	return <PixiViewportComponent ref={ setViewPort } app={ useApp() } { ...props } />;
});
PixiViewport.displayName = 'PixiViewport';
