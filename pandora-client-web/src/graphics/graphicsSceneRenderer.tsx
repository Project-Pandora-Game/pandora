import { Assert, AssertNotNullable, GetLogger, Rectangle } from 'pandora-common';
import { Application, Container } from 'pixi.js';
import React, { Context, ReactElement, ReactNode } from 'react';
import { CalculationQueue } from '../common/calculationQueue';
import { ChildrenProps } from '../common/reactTypes';
import { useErrorHandler } from '../common/useErrorHandler';
import { ForwardingErrorBoundary } from '../components/error/forwardingErrorBoundary';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary';
import { GetApplicationManager, ReleaseApplicationManager, type GraphicsApplicationManager } from './graphicsAppManager';
import { DEFAULT_BACKGROUND_COLOR } from './graphicsScene';
import { PixiAppContext } from './reconciler/appContext';
import { CreatePixiRoot, type PixiRoot } from './reconciler/reconciler';

export interface GraphicsSceneRendererProps extends ChildrenProps {
	container: HTMLDivElement;
	resolution: number;
	backgroundColor?: number;
	backgroundAlpha?: number;
	onMount?: (app: Application) => void;
	onUnmount?: (app: Application) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	forwardContexts: readonly Context<any>[];
}

class GraphicsSceneRendererSharedImpl extends React.Component<Omit<GraphicsSceneRendererProps, 'forwardContexts'>> {
	private _needsUpdate: boolean = true;
	private _animationFrameRequest: number | null = null;
	private _cleanupUpdateCallback: undefined | (() => void);
	private root: PixiRoot | null = null;
	private appManager: GraphicsApplicationManager | null = null;
	private _appManagerReadyCleanupCallback: undefined | (() => void);
	private app: Application | null = null;

	private readonly logger = GetLogger('GraphicsSceneRendererShared');

	public override render(): React.ReactNode {
		return null;
	}

	public override componentDidMount() {
		this.logger.debug('Mount');
		const appManager = GetApplicationManager();
		if (!appManager)
			return;

		Assert(this._appManagerReadyCleanupCallback == null);
		this.appManager = appManager;
		const app = appManager.app;
		if (app != null) {
			this._mountApp(app);
		} else {
			appManager.on('applicationReady', this._mountApp.bind(this));
		}
	}

	public override componentDidUpdate(oldProps: Readonly<Omit<GraphicsSceneRendererProps, 'forwardContexts'>>) {
		const {
			container,
			resolution,
			backgroundColor,
			backgroundAlpha,
		} = this.props;

		let needsUpdate = false;

		if (container !== oldProps.container && this.app != null) {
			this.app.canvas.remove();
			container.appendChild(this.app.canvas);
			this.app.resizeTo = container;
			this.app.resize();
			needsUpdate = true;
		}

		if (resolution !== oldProps.resolution && this.app != null) {
			this.app.renderer.resolution = resolution;
			this.app.resize();
			needsUpdate = true;
		}

		if (backgroundColor !== oldProps.backgroundColor && this.app != null) {
			this.app.renderer.background.color = backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
			needsUpdate = true;
		}

		if (backgroundAlpha !== oldProps.backgroundAlpha && this.app != null) {
			this.app.renderer.background.alpha = backgroundAlpha ?? 1;
			needsUpdate = true;
		}

		// flush fiber
		if (this.root != null) {
			this.root.render(this.getChildren());
		}

		if (needsUpdate) {
			this.needsRenderUpdate();
		}
	}

	public override componentWillUnmount() {
		this.logger.debug('Unmount');

		this._appManagerReadyCleanupCallback?.();
		this._appManagerReadyCleanupCallback = undefined;

		const appManager = this.appManager;
		this.appManager = null;

		this._unmountApp();

		if (appManager != null) {
			ReleaseApplicationManager(appManager);
		}
	}

	private _mountApp(app: Application): void {
		const {
			onMount,
			container,
			resolution,
			backgroundColor = DEFAULT_BACKGROUND_COLOR,
			backgroundAlpha = 1,
		} = this.props;

		if (this.app === app)
			return;
		Assert(this.app == null);
		this.app = app;
		Assert(app.canvas instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

		this.logger.debug('Mounting application');

		app.renderer.resolution = resolution;
		this.app.resizeTo = container;
		this.app.resize();
		app.renderer.background.color = backgroundColor;
		app.renderer.background.alpha = backgroundAlpha;
		container.appendChild(app.canvas);
		onMount?.(this.app);

		this.root = CreatePixiRoot(this.app.stage);
		this.root.render(this.getChildren());

		Assert(this._cleanupUpdateCallback == null);
		this._cleanupUpdateCallback = this.root.updateEmitter.on('needsUpdate', this.needsRenderUpdate);

		this.needsRenderUpdate();
	}

	private _unmountApp(): void {
		const { onUnmount } = this.props;

		this.logger.debug('Unmounting application');

		this._cleanupUpdateCallback?.();
		this._cleanupUpdateCallback = undefined;

		if (this.root != null) {
			this.root.unmount();
			this.root = null;
		}

		// Now we manually clear the children, so the app can be immediately reused without remnants
		if (this.app != null) {
			onUnmount?.(this.app);
			this.app.resizeTo = window;
			this.app.stage
				.removeChildren()
				.forEach((c) => c.destroy({
					children: true,
				}));

			this.app.canvas.remove();
			this.app = null;
		}

		// Cancel any pending frame request
		if (this._animationFrameRequest != null) {
			cancelAnimationFrame(this._animationFrameRequest);
			this._animationFrameRequest = null;
		}
	}

	private _requestAnimationFrame() {
		if (this._animationFrameRequest != null) {
			return;
		}
		this._animationFrameRequest = requestAnimationFrame(this._onAnimationFrame);
	}

	private _onAnimationFrame: FrameRequestCallback = () => {
		this._animationFrameRequest = null;
		this.renderStage();
	};

	public needsRenderUpdate = () => {
		this._needsUpdate = true;
		this._requestAnimationFrame();
	};

	public renderStage = () => {
		if (this._needsUpdate && this.app != null) {
			this._needsUpdate = false;
			this.app.ticker.update();
		}
	};

	public getChildren() {
		const { children } = this.props;
		AssertNotNullable(this.app);
		return <PixiAppContext.Provider value={ this.app }>{ children }</PixiAppContext.Provider>;
	}

	public override componentDidCatch(error: unknown, errorInfo: unknown) {
		GetLogger('Stage').error(`Error occurred in \`Stage\`.\n`, error, '\n', errorInfo);
	}
}

export function GraphicsSceneRendererShared({
	children,
	resolution,
	backgroundColor,
	backgroundAlpha,
	onMount,
	onUnmount,
	container,
	forwardContexts,
}: GraphicsSceneRendererProps): ReactElement {
	const errorHandler = useErrorHandler();

	return (
		<ContextBridge contexts={ forwardContexts } render={ (c) => (
			<GraphicsSceneRendererSharedImpl
				resolution={ resolution }
				backgroundColor={ backgroundColor }
				backgroundAlpha={ backgroundAlpha }
				onMount={ onMount }
				onUnmount={ onUnmount }
				container={ container }
			>
				<ForwardingErrorBoundary errorHandler={ errorHandler }>
					{ c }
				</ForwardingErrorBoundary>
			</GraphicsSceneRendererSharedImpl>
		) }>
			<React.StrictMode>
				{ children }
			</React.StrictMode>
		</ContextBridge>
	);
}

interface GraphicsSceneBackgroundRendererProps extends Omit<GraphicsSceneRendererProps, 'container'> {
	renderArea: Rectangle;
}

const backgroundRenderingQueue = new CalculationQueue({
	normal: 75,
});

class GraphicsSceneBackgroundRendererImpl extends React.Component<Omit<GraphicsSceneBackgroundRendererProps, 'forwardContexts'>> {
	private readonly logger = GetLogger('BackgroundRenderer');

	private _needsUpdate: boolean = false;
	private _cleanupUpdateCallback: undefined | (() => void);

	private _canvasRef: HTMLCanvasElement | null = null;
	private _root: PixiRoot | null = null;
	private _stage: Container | null = null;

	private _appManager: GraphicsApplicationManager | null = null;
	private _app: Application | null = null;

	public override render(): React.ReactNode {
		const { renderArea } = this.props;

		return (
			<canvas
				ref={ this._canvasRefHandle }
				width={ renderArea.width }
				height={ renderArea.height }
			/>
		);
	}

	private readonly _canvasRefHandle = (ref: HTMLCanvasElement | null) => {
		this._canvasRef = ref;
		if (ref != null) {
			this.needsRenderUpdate();
		}
	};

	public override componentDidMount() {
		Assert(this._root == null);
		Assert(this._stage == null);

		const { renderArea } = this.props;

		this._stage = new Container();
		this._stage.position = {
			x: -renderArea.x,
			y: -renderArea.y,
		};

		this._root = CreatePixiRoot(this._stage);
		this._root.render(this.getChildren());

		Assert(this._cleanupUpdateCallback == null);
		this._cleanupUpdateCallback = this._root.updateEmitter.on('needsUpdate', this.needsRenderUpdate);
		this.needsRenderUpdate();
	}

	public override componentDidUpdate(_oldProps: Readonly<Omit<GraphicsSceneBackgroundRendererProps, 'forwardContexts'>>) {
		if (!this._stage && !this._root)
			return;
		AssertNotNullable(this._stage);
		AssertNotNullable(this._root);

		const { renderArea } = this.props;

		// Update stage offset
		this._stage.position = {
			x: -renderArea.x,
			y: -renderArea.y,
		};

		// flush fiber
		this._root.render(this.getChildren());
		this.needsRenderUpdate();
	}

	public override componentWillUnmount() {
		AssertNotNullable(this._root);
		AssertNotNullable(this._stage);

		this._cleanupUpdateCallback?.();
		this._cleanupUpdateCallback = undefined;

		this._root.unmount();
		this._root = null;

		// Now we manually destroy the stage
		this._stage.destroy({
			children: true,
		});
		this._stage = null;
	}

	public readonly needsRenderUpdate = () => {
		if (!this._needsUpdate) {
			this._needsUpdate = true;
			backgroundRenderingQueue.calculate('normal', this.renderStage);
		}
	};

	public readonly renderStage = () => {
		if (!this._needsUpdate)
			return;
		this._needsUpdate = false;

		// Check if we can render now, otherwise re-queue
		if (this._stage == null || this._canvasRef == null || !this._mountApp()) {
			this.needsRenderUpdate();
			return;
		}

		AssertNotNullable(this._app);

		this._app.ticker.update();

		const outContext = this._canvasRef.getContext('2d');
		if (outContext) {
			outContext.clearRect(0, 0, this._canvasRef.width, this._canvasRef.height);
			outContext.drawImage(this._app.canvas, 0, 0, this._canvasRef.width, this._canvasRef.height);
		} else {
			this.logger.warning('Failed to get output 2d context');
		}
		this._unmountApp();
	};

	private _mountApp(): boolean {
		Assert(this._appManager == null);
		Assert(this._app == null);
		Assert(this._stage != null);
		const {
			onMount,
			resolution,
			renderArea,
			backgroundColor = DEFAULT_BACKGROUND_COLOR,
			backgroundAlpha = 1,
		} = this.props;

		const appManager = GetApplicationManager();
		if (!appManager)
			return false;

		const app = appManager.app;
		if (app == null) {
			ReleaseApplicationManager(appManager);
			return false;
		}

		this._appManager = appManager;
		this._app = app;
		Assert(app.canvas instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

		app.renderer.resolution = resolution;
		app.renderer.resize(renderArea.width, renderArea.height);
		app.renderer.background.color = backgroundColor;
		app.renderer.background.alpha = backgroundAlpha;
		app.stage.addChild(this._stage);

		onMount?.(this._app);
		return true;
	}

	private _unmountApp() {
		const { onUnmount } = this.props;

		if (this._app != null) {
			onUnmount?.(this._app);
			this._app.stage.removeChildren();
			this._app = null;
		}

		if (this._appManager != null) {
			const appManager = this._appManager;
			this._appManager = null;
			ReleaseApplicationManager(appManager);
		}
	}

	public getChildren() {
		const { children } = this.props;
		return <>{ children }</>;
	}

	public override componentDidCatch(error: unknown, errorInfo: unknown) {
		this.logger.error(`Error occurred in \`Stage\`.\n`, error, '\n', errorInfo);
	}
}

function GraphicsSceneBackgroundRendererUnsafe({
	children,
	renderArea,
	resolution,
	backgroundColor,
	backgroundAlpha,
	onMount,
	onUnmount,
	forwardContexts,
}: GraphicsSceneBackgroundRendererProps): ReactElement {
	const errorHandler = useErrorHandler();

	return (
		<ContextBridge contexts={ forwardContexts } render={ (c) => (
			<GraphicsSceneBackgroundRendererImpl
				renderArea={ renderArea }
				resolution={ resolution }
				backgroundColor={ backgroundColor }
				backgroundAlpha={ backgroundAlpha }
				onMount={ onMount }
				onUnmount={ onUnmount }
			>
				<ForwardingErrorBoundary errorHandler={ errorHandler }>
					{ c }
				</ForwardingErrorBoundary>
			</GraphicsSceneBackgroundRendererImpl>
		) }>
			<React.StrictMode>
				{ children }
			</React.StrictMode>
		</ContextBridge>
	);
}

export function GraphicsSceneBackgroundRenderer(props: GraphicsSceneBackgroundRendererProps): ReactElement {
	return (
		<LocalErrorBoundary>
			<GraphicsSceneBackgroundRendererUnsafe { ...props } />
		</LocalErrorBoundary>
	);
}

export function ContextBridge({ children, contexts, render }: {
	children: ReactNode;
	contexts: readonly Context<unknown>[];
	render: (children: ReactNode) => ReactNode;
}): ReactElement {
	if (contexts.length === 0) {
		return <>{ render(children) }</>;
	}

	const { Consumer, Provider } = contexts[0];

	return (
		<Consumer>
			{ (value) => (
				<ContextBridge contexts={ contexts.slice(1) } render={ render }>
					<Provider value={ value }>
						{ children }
					</Provider>
				</ContextBridge>
			) }
		</Consumer>
	);
}
