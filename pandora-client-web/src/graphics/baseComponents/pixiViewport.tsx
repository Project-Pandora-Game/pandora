import type { Rectangle } from 'pandora-common';
import { Viewport } from 'pixi-viewport';
import { type Application, Point } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { usePixiApp } from '../reconciler/appContext.ts';
import { RegisterPixiComponent } from '../reconciler/component.ts';
import { PixiElementRequestUpdate } from '../reconciler/element.ts';
import { usePixiTick } from '../reconciler/tick.ts';
import { CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

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
	setup?: PixiViewportSetupCallback;
	onMove?: (viewport: Viewport) => void;
}

const PixiViewportComponent = RegisterPixiComponent<Viewport, never, ContainerEventMap, PixiViewportProps & { app: Application; }>('Viewport', {
	create(props) {
		const {
			app,
			width,
			height,
			worldWidth,
			worldHeight,
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

		setup?.(viewport, {
			width,
			height,
			worldWidth,
			worldHeight,
		});

		return viewport;
	},
	applyCustomProps(viewport, oldProps, newProps) {
		const {
			app: oldApp,
			width: oldWidth,
			height: oldHeight,
			worldWidth: oldWorldWidth,
			worldHeight: oldWorldHeight,
			setup: oldSetup,
		} = oldProps as Partial<typeof newProps>;
		const {
			app,
			width,
			height,
			worldWidth,
			worldHeight,
			setup,
		} = newProps;

		if (app !== oldApp) {
			viewport.options.events = app.renderer.events;
		}

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
	autoProps: {},
	events: CONTAINER_EVENTS,
});

export type PixiViewportRef = {
	readonly viewport: Viewport | null;
	getCenter(): Point | undefined;
	center(area?: Rectangle): void;
	fitCover(): void;
};

export const PixiViewport = forwardRef<PixiViewportRef, PixiViewportProps>((props, ref) => {
	const [viewPort, setViewPort] = useState<Viewport | null>(null);
	const app = usePixiApp();
	const { onMove } = props;

	useImperativeHandle(ref, () => ({
		viewport: viewPort,
		getCenter: () => viewPort?.center,
		center: (rectangle) => {
			if (!viewPort)
				return;

			if (rectangle) {
				viewPort.fit(false, rectangle.width, rectangle.height);
				viewPort.moveCenter(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2);
			} else {
				viewPort.fit();
				viewPort.moveCenter(viewPort.worldWidth / 2, viewPort.worldHeight / 2);
			}
			PixiElementRequestUpdate(viewPort);
			onMove?.(viewPort);
		},
		fitCover: () => {
			if (!viewPort)
				return;
			viewPort.setZoom(viewPort.findCover(viewPort.worldWidth, viewPort.worldHeight));
			viewPort.moveCenter(viewPort.worldWidth / 2, viewPort.worldHeight / 2);
			PixiElementRequestUpdate(viewPort);
			onMove?.(viewPort);
		},
	}), [onMove, viewPort]);

	usePixiTick((ticker) => {
		viewPort?.update(ticker.elapsedMS);
	});

	useEffect(() => {
		if (!viewPort)
			return;

		const events = ['moved', 'zoomed'] as const;

		const update = () => {
			PixiElementRequestUpdate(viewPort);
			onMove?.(viewPort);
		};

		for (const e of events) {
			viewPort.on(e, update);
		}
		return () => {
			for (const e of events) {
				viewPort.off(e, update);
			}
		};
	}, [viewPort, onMove]);

	return <PixiViewportComponent ref={ setViewPort } app={ app } { ...props } />;
});
PixiViewport.displayName = 'PixiViewport';
