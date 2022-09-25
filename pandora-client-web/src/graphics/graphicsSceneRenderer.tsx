import React from 'react';
import { Assert } from 'pandora-common';
import type { GraphicsScene } from './graphicsScene';
import _ from 'lodash';

export type SceneConstructor<T extends GraphicsScene = GraphicsScene> = () => (T | null | undefined);

export interface GraphicsSceneRendererProps<T extends GraphicsScene = GraphicsScene> extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
	scene: SceneConstructor<T>;
	onScene?: (app: T | null) => void;
}

export class GraphicsSceneRenderer<T extends GraphicsScene = GraphicsScene> extends React.Component<GraphicsSceneRendererProps<T>> {
	private _target: HTMLElement | null = null;
	private _app: T | null = null;

	override componentDidMount() {
		const { scene, onScene } = this.props;

		Assert(this._app == null);

		this._app = scene() ?? null;
		if (this._app && this._target != null) {
			this._app.renderTo(this._target);
		}
		onScene?.(this._app);
	}

	override componentDidUpdate(prevProps: Readonly<GraphicsSceneRendererProps<T>>): void {
		Assert(this._target != null);

		const { scene, onScene } = this.props;

		if (scene !== prevProps.scene) {
			this._app?.destroy();
			this._app = scene() ?? null;
			if (this._app) {
				this._app.renderTo(this._target);
			}
			onScene?.(this._app);
		} else if (onScene !== prevProps.onScene) {
			onScene?.(this._app);
		}
	}

	override componentWillUnmount() {
		const { onScene } = this.props;

		this._app?.destroy();
		this._app = null;
		onScene?.(null);
	}

	private readonly _setTargetRefBound = (c: HTMLDivElement) => this.setTargetRef(c);
	private setTargetRef(element: HTMLElement | null) {
		if (this._target === element)
			return;

		this._target = element;
		if (this._app && element != null) {
			this._app.renderTo(element);
		}
	}

	override render() {
		const divProps = _.omit(this.props, ['scene', 'onScene']);

		return <div { ...divProps } ref={ this._setTargetRefBound } />;
	}
}
