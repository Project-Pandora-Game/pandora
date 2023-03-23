import React, { Context, ReactElement, ReactNode, useMemo } from 'react';
import { Application, IApplicationOptions, Ticker } from 'pixi.js';
import { Assert, AssertNotNullable, GetLogger } from 'pandora-common';
import { AppProvider, createRoot, ReactPixiRoot, Stage } from '@pixi/react';
import { cloneDeep } from 'lodash';
import { ChildrenProps } from '../common/reactTypes';
import { USER_DEBUG } from '../config/Environment';

const SHARED_APP_MAX_COUNT = 1;

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
	forwardContexts?: readonly Context<any>[];
}

export function GraphicsSceneRendererDirect({
	children,
	resolution,
	onMount,
	onUnmount,
	forwardContexts = [],
}: GraphicsSceneRendererProps): ReactElement {
	const options = useMemo<Partial<IApplicationOptions>>(() => ({
		...cloneDeep(PIXI_APPLICATION_OPTIONS),
		resolution,
	}), [resolution]);

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
				{ children }
			</React.StrictMode>
		</ContextBridge>
	);
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
	private _ticker: Ticker | null = null;
	private _needsUpdate: boolean = true;
	private root: ReactPixiRoot | null = null;
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

		// We are trying to simulate how `Stage` component works, only differently handing the Application instance
		// For that we need to add this private shim `react-pixi` normally adds inside `Stage`,
		// Which is used to propagate change events all the way up to the stage quickly, so application knows to render another frame
		// @see - https://github.com/wisebits-tech/react-pixi/blob/react-18/src/stage/index.jsx#L127
		// @ts-expect-error: Private shim
		app.stage.__reactpixi = { root: this.app.stage };
		this.root = createRoot(this.app.stage);
		this.root.render(this.getChildren());

		onMount?.(this.app);

		// listen for reconciler changes
		this._ticker = new Ticker();
		this._ticker.autoStart = true;
		this._ticker.add(this.renderStage);
		this.app.stage.on('__REACT_PIXI_REQUEST_RENDER__', this.needsRenderUpdate);

		this._needsUpdate = true;
		this.renderStage();
	}

	public override componentDidUpdate(oldProps: Readonly<Omit<GraphicsSceneRendererProps, 'forwardContexts'>>) {
		if (!this.app && !this.root)
			return;
		AssertNotNullable(this.app);
		AssertNotNullable(this.root);

		const { container, resolution } = this.props;
		const { container: oldContainer, resolution: oldResolution } = oldProps;

		if (container !== oldContainer) {
			this.app.view.remove();
			container.appendChild(this.app.view);
			this.app.resizeTo = container;
			this.app.resize();
		}

		if (resolution !== oldResolution) {
			this.app.renderer.resolution = resolution;
			this.app.resize();
		}

		// flush fiber
		this.root.render(this.getChildren());
		this.app.render();
	}

	public override componentWillUnmount() {
		if (!this.app && !this.root)
			return;

		const { onUnmount } = this.props;
		AssertNotNullable(this.app);
		AssertNotNullable(this.root);

		this.app.stage.off('__REACT_PIXI_REQUEST_RENDER__', this.needsRenderUpdate);
		if (this._ticker) {
			this._ticker.remove(this.renderStage);
			this._ticker.destroy();
			this._ticker = null;
		}

		onUnmount?.(this.app);

		// We need to render empty stage, otherwise we have a leak as we don't destroy app, as react-pixi expects
		this.root.render(<AppProvider value={ this.app } />);
		this.root.unmount();
		this.root = null;

		// Now we manually clear the children, so the app can be immediately reused without remnants
		this.app.stage
			.removeChildren()
			.forEach((c) => c.destroy({
				children: true,
			}));

		this.app.view.remove();
		AvailableApps.push(this.app);
		this.app = null;
	}

	public needsRenderUpdate = () => {
		this._needsUpdate = true;
	};

	public renderStage = () => {
		AssertNotNullable(this.app);
		if (this._needsUpdate) {
			this._needsUpdate = false;
			this.app.render();
		}
	};

	public getChildren() {
		const { children } = this.props;
		AssertNotNullable(this.app);
		return <AppProvider value={ this.app }>{ children }</AppProvider>;
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
	forwardContexts = [],
}: GraphicsSceneRendererProps): ReactElement {
	return (
		<ContextBridge contexts={ forwardContexts } render={ (c) => (
			<GraphicsSceneRendererSharedImpl
				resolution={ resolution }
				onMount={ onMount }
				onUnmount={ onUnmount }
				container={ container }
			>
				{ c }
			</GraphicsSceneRendererSharedImpl>
		) }>
			<React.StrictMode>
				{ children }
			</React.StrictMode>
		</ContextBridge>
	);
}

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
						{ children }
					</Ctx.Provider>
				</ContextBridge>
			) }
		</Ctx.Consumer>
	);
}
