import { Assert, AssertNotNullable, CreateManuallyResolvedPromise, type Rectangle } from 'pandora-common';
import { Application, Container } from 'pixi.js';
import type { ReactNode } from 'react';
import { ForwardingErrorBoundary } from '../../components/error/forwardingErrorBoundary.tsx';
import { DEFAULT_BACKGROUND_COLOR, ReleaseApplicationManager, WaitForApplicationManager, type GraphicsApplicationManager } from '../graphicsAppManager.ts';
import { GraphicsSuspenseContext, GraphicsSuspenseManager } from '../graphicsSuspense/graphicsSuspense.tsx';
import { PixiAppContext } from '../reconciler/appContext.ts';
import { CreatePixiRoot } from '../reconciler/reconciler.ts';
import { PixiTicker, PixiTickerContext } from '../reconciler/tick.ts';

export async function RenderGraphicsTreeInBackground(
	graphics: ReactNode,
	frame: Rectangle,
	backgroundColor: number = DEFAULT_BACKGROUND_COLOR,
	backgroundAlpha: number = 1,
): Promise<HTMLCanvasElement> {
	// We need some form of suspense management to wait for textures to load
	const suspenseManager = new GraphicsSuspenseManager();
	const ticker = new PixiTicker();

	// Init stage and React root
	const stage = new Container();
	stage.position = {
		x: -frame.x,
		y: -frame.y,
	};

	const root = CreatePixiRoot(stage);
	let appManager: GraphicsApplicationManager | null = null;
	let app: Application | undefined;

	try {
		const { promise: errorPromise, reject: errorHandler } = CreateManuallyResolvedPromise<void>();

		// Get ourselves an App for rendering
		appManager = await WaitForApplicationManager();

		app = await new Promise<Application>((resolve) => {
			AssertNotNullable(appManager);
			const cleanup = appManager.on('applicationReady', (readyApp) => {
				cleanup();
				resolve(readyApp);
			});
			if (appManager.app != null) {
				cleanup();
				resolve(appManager.app);
			}
		});

		// Render tree into the stage
		root.render((
			<PixiAppContext.Provider value={ app }>
				<PixiTickerContext.Provider value={ ticker }>
					<GraphicsSuspenseContext.Provider value={ suspenseManager }>
						<ForwardingErrorBoundary errorHandler={ errorHandler }>
							{ graphics }
						</ForwardingErrorBoundary>
					</GraphicsSuspenseContext.Provider>
				</PixiTickerContext.Provider>
			</PixiAppContext.Provider>
		), true);

		// Flush the render
		await Promise.race([
			root.flush(),
			errorPromise,
		]);

		// Wait until suspense reports ready
		await Promise.race([
			new Promise<void>((resolve) => {
				suspenseManager.on('update', () => {
					if (suspenseManager.isReady) {
						resolve();
					}
				});
				if (suspenseManager.isReady) {
					resolve();
				}
			}),
			errorPromise,
		]);

		Assert(app.canvas instanceof HTMLCanvasElement, 'Expected app.canvas to be an HTMLCanvasElement');

		// Setup the app's stage
		app.renderer.resize(frame.width, frame.height, 1);
		app.renderer.background.color = backgroundColor;
		app.renderer.background.alpha = backgroundAlpha;
		app.stage.addChild(stage);

		// Setup and run ticker to render the stage
		app.ticker.addOnce((t) => ticker.tick(t));
		app.ticker.update();

		// Create our result canvas and copy the result out
		const resultCanvas = document.createElement('canvas');
		resultCanvas.width = frame.width;
		resultCanvas.height = frame.height;
		const ctx = resultCanvas.getContext('2d');
		if (ctx == null) {
			throw new Error('Failed to get result canvas context');
		}
		ctx.clearRect(0, 0, frame.width, frame.height);
		ctx.drawImage(app.canvas, 0, 0, frame.width, frame.height);

		return resultCanvas;
	} finally {
		// Cleanup resources we used
		if (app != null) {
			app.stage.removeChildren();
			app = undefined;
		}
		if (appManager != null) {
			ReleaseApplicationManager(appManager);
			appManager = null;
		}
		root.unmount();
		stage.destroy({
			children: true,
		});
	}
}
