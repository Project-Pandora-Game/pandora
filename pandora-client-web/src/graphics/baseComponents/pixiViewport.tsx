import { Viewport } from 'pixi-viewport';
import { Application, Point } from 'pixi.js';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { usePixiApp } from '../reconciler/appContext';
import { RegisterPixiComponent } from '../reconciler/component';
import { PixiElementRequestUpdate } from '../reconciler/element';
import { usePixiTick } from '../reconciler/tick';
import { CONTAINER_EVENTS, type ContainerEventMap } from './container';

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

const PixiViewportComponent = RegisterPixiComponent<Viewport, never, ContainerEventMap, PixiViewportProps & { app: Application; }>('Viewport', {
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
	autoProps: {},
	events: CONTAINER_EVENTS,
});

export type PixiViewportRef = {
	getCenter(): Point | undefined;
	center(): void;
};

export const PixiViewport = forwardRef<PixiViewportRef, PixiViewportProps>((props, ref) => {
	const [viewPort, setViewPort] = useState<Viewport | null>(null);
	const app = usePixiApp();

	useImperativeHandle(ref, () => ({
		getCenter: () => viewPort?.center,
		center: () => {
			if (!viewPort)
				return;
			viewPort.fit();
			viewPort.moveCenter(viewPort.worldWidth / 2, viewPort.worldHeight / 2);
			PixiElementRequestUpdate(viewPort);
		},
	}), [viewPort]);

	usePixiTick((ticker) => {
		viewPort?.update(ticker.elapsedMS);
	});

	useEffect(() => {
		if (!viewPort)
			return;

		const events = ['moved', 'zoomed'] as const;

		const update = () => {
			PixiElementRequestUpdate(viewPort);
		};

		for (const e of events) {
			viewPort.on(e, update);
		}
		return () => {
			for (const e of events) {
				viewPort.off(e, update);
			}
		};
	}, [viewPort]);

	return <PixiViewportComponent ref={ setViewPort } app={ app } { ...props } />;
});
PixiViewport.displayName = 'PixiViewport';
