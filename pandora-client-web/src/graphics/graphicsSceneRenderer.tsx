import { cloneDeep } from 'lodash';
import { Assert, AssertNotNullable, GetLogger, Rectangle } from 'pandora-common';
import { Application, Container, IApplicationOptions } from 'pixi.js';
import React, { Context, ReactElement, ReactNode } from 'react';
import { CalculationQueue } from '../common/calculationQueue';
import { ChildrenProps } from '../common/reactTypes';
import { useErrorHandler } from '../common/useErrorHandler';
import { ForwardingErrorBoundary } from '../components/error/forwardingErrorBoundary';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary';
import { USER_DEBUG } from '../config/Environment';
import { DEFAULT_BACKGROUND_COLOR } from './graphicsScene';
import { PixiAppContext } from './reconciler/appContext';
import { CreatePixiRoot, type PixiRoot } from './reconciler/reconciler';

const SHARED_APP_MAX_COUNT = 2;

export const PIXI_APPLICATION_OPTIONS: Readonly<Partial<IApplicationOptions>> = {
	backgroundColor: 0x1099bb,
	resolution: window.devicePixelRatio || 1,
	// Antialias **NEEDS** to be explicitly disabled - having it enabled causes seams when using filters (such as alpha masks)
	antialias: false,
};

function CreateApplication(): Application<HTMLCanvasElement> {
	return new Application({
		...cloneDeep(PIXI_APPLICATION_OPTIONS),
		autoDensity: true,
		autoStart: false,
	});
}

export interface GraphicsSceneRendererProps extends ChildrenProps {
	container: HTMLDivElement;
	resolution: number;
	onMount?: (app: Application) => void;
	onUnmount?: (app: Application) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	forwardContexts: readonly Context<any>[];
}

// This actually has more effect than just exposing for debugging purposes:
// It allows hot reload to reuse existing apps instead of having leak during development
interface WindowWithSharedApps extends Window {
	pandoraPixiApps?: Application<HTMLCanvasElement>[];
	pandoraPixiAppsAvailable?: Application<HTMLCanvasElement>[];
}

const SharedApps: Application<HTMLCanvasElement>[] = (USER_DEBUG && Array.isArray((window as WindowWithSharedApps).pandoraPixiApps)) ? ((window as WindowWithSharedApps).pandoraPixiApps ?? []) : [];
const AvailableApps: Application<HTMLCanvasElement>[] = (USER_DEBUG && Array.isArray((window as WindowWithSharedApps).pandoraPixiAppsAvailable)) ? ((window as WindowWithSharedApps).pandoraPixiAppsAvailable ?? []) : [];

if (USER_DEBUG) {
	(window as WindowWithSharedApps).pandoraPixiApps = SharedApps;
	(window as WindowWithSharedApps).pandoraPixiAppsAvailable = AvailableApps;
}

class GraphicsSceneRendererSharedImpl extends React.Component<Omit<GraphicsSceneRendererProps, 'forwardContexts'>> {
	private _needsUpdate: boolean = true;
	private _animationFrameRequest: number | null = null;
	private _cleanupUpdateCallback: undefined | (() => void);
	private root: PixiRoot | null = null;
	private app: Application<HTMLCanvasElement> | null = null;

	public override render(): React.ReactNode {
		return null;
	}

	public override componentDidMount() {
		const { onMount, container, resolution } = this.props;

		let app = AvailableApps.pop();
		if (!app && SharedApps.length < SHARED_APP_MAX_COUNT) {
			app = CreateApplication();
			SharedApps.push(app);
		}
		if (!app)
			return;

		this.app = app;
		Assert(app.view instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

		app.renderer.resolution = resolution;
		container.appendChild(app.view);
		this.app.resizeTo = container;
		this.app.resize();

		this.root = CreatePixiRoot(this.app.stage);
		this.root.render(this.getChildren());

		onMount?.(this.app);

		Assert(this._cleanupUpdateCallback == null);
		this._cleanupUpdateCallback = this.root.updateEmitter.on('needsUpdate', this.needsRenderUpdate);

		this.needsRenderUpdate();
	}

	public override componentDidUpdate(oldProps: Readonly<Omit<GraphicsSceneRendererProps, 'forwardContexts'>>) {
		if (!this.app && !this.root)
			return;
		AssertNotNullable(this.app);
		AssertNotNullable(this.root);

		const { container, resolution } = this.props;
		const { container: oldContainer, resolution: oldResolution } = oldProps;

		let needsUpdate = false;

		if (container !== oldContainer) {
			this.app.view.remove();
			container.appendChild(this.app.view);
			this.app.resizeTo = container;
			this.app.resize();
			needsUpdate = true;
		}

		if (resolution !== oldResolution) {
			this.app.renderer.resolution = resolution;
			this.app.resize();
			needsUpdate = true;
		}

		// flush fiber
		this.root.render(this.getChildren());

		if (needsUpdate) {
			this.needsRenderUpdate();
		}
	}

	public override componentWillUnmount() {
		if (!this.app && !this.root)
			return;

		const { onUnmount } = this.props;
		AssertNotNullable(this.app);
		AssertNotNullable(this.root);

		this._cleanupUpdateCallback?.();
		this._cleanupUpdateCallback = undefined;

		onUnmount?.(this.app);

		this.root.unmount();
		this.root = null;

		// Now we manually clear the children, so the app can be immediately reused without remnants
		this.app.stage
			.removeChildren()
			.forEach((c) => c.destroy({
				children: true,
			}));

		// Cancel any pending frame request
		if (this._animationFrameRequest != null) {
			cancelAnimationFrame(this._animationFrameRequest);
			this._animationFrameRequest = null;
		}

		this.app.view.remove();
		AvailableApps.push(this.app);
		this.app = null;
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
	backgroundColor?: number;
	backgroundAlpha?: number;
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

	private _app: Application<HTMLCanvasElement> | null = null;

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
			outContext.drawImage(this._app.view, 0, 0, this._canvasRef.width, this._canvasRef.height);
		} else {
			this.logger.warning('Failed to get output 2d context');
		}
		this._unmountApp();
	};

	private _mountApp(): boolean {
		Assert(this._app == null);
		Assert(this._stage != null);
		const {
			onMount,
			resolution,
			renderArea,
			backgroundColor = DEFAULT_BACKGROUND_COLOR,
			backgroundAlpha = 1,
		} = this.props;

		let app = AvailableApps.pop();
		if (!app && SharedApps.length < SHARED_APP_MAX_COUNT) {
			app = CreateApplication();
			SharedApps.push(app);
		}
		if (!app)
			return false;

		this._app = app;
		Assert(app.view instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

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
		if (this._app == null)
			return;

		onUnmount?.(this._app);
		this._app.stage.removeChildren();

		AvailableApps.push(this._app);
		this._app = null;
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
