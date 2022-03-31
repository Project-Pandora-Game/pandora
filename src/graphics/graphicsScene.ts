import { Application, Container, Sprite, Texture } from 'pixi.js';
import { useRef, useEffect } from 'react';
import { ObservableSet } from '../observable';

export class GraphicsScene extends ObservableSet<{ resize: void; }> {
	private readonly _app: Application;
	private readonly _container: Container;

	get width(): number {
		return this._app.renderer.width;
	}

	get height(): number {
		return this._app.renderer.height;
	}

	constructor() {
		super();
		this._app = new Application({
			backgroundColor: 0x1099bb,
			resolution: window.devicePixelRatio || 1,
			antialias: true,
		});
		this._container = new Container();
		this._container.sortableChildren = true;
		this._app.stage.addChild(this._container);
	}

	renderTo(element: HTMLElement): () => void {
		this._app.view.parentNode?.removeChild(this._app.view);
		this._app.resizeTo = element;
		element.appendChild(this._app.view);
		this.resize();
		return () => {
			this._app.resizeTo = window;
		};
	}

	resize(): void {
		this._app.resize();
		this.dispatch('resize', undefined);
	}

	add<T extends Container>(container: T, zIndex: number = 0): T {
		const result = this._container.addChild(container);
		result.zIndex = zIndex;
		return result;
	}

	remove(container: Container): void {
		this._container.removeChild(container);
	}

	private _background = '';
	private _backgroundSprite?: Sprite;
	get background(): string {
		if (this._background) return this.background;
		const { backgroundColor } = this._app.renderer;
		return `#${backgroundColor.toString(16).padStart(6, '0')}`;
	}
	set background(data: string) {
		if (/#[0-9a-f]{6, 8}/i.test(data)) {
			this._background = '';
			this._backgroundSprite?.destroy();
			this._backgroundSprite = undefined;
			this._app.renderer.backgroundColor = parseInt(data.substring(1, 7), 16);
			if (data.length > 7) {
				this._app.renderer.backgroundAlpha = parseInt(data.substring(7, 9), 16) / 255;
			}
		} else if (/data:image\/png;base64,[0-9a-zA-Z+/=]+/i.test(data)) {
			this._background = data;
			const img = new Image();
			img.src = data;
			this._backgroundSprite = this.add(new Sprite(Texture.from(img)), -1000);
			this._backgroundSprite.width = this._app.renderer.width;
			this._backgroundSprite.height = this._app.renderer.height;
		} else if (/https?:\/\/.+/i.test(data)) {
			this._background = data;
			(async () => {
				this._backgroundSprite = this.add(new Sprite(await Texture.fromURL(data)), -1000);
				this._backgroundSprite.width = this._app.renderer.width;
				this._backgroundSprite.height = this._app.renderer.height;
			})().catch(() => { /** */ });
		} else {
			// eslint-disable-next-line no-console
			console.log('Invalid background data: ' + data);
		}
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useGraphicsScene<T extends HTMLElement>(scene: GraphicsScene): React.RefObject<T> {
	const ref = useRef<T>(null);
	useEffect(() => {
		let cleanup: undefined | (() => void);
		if (ref.current) {
			cleanup = scene.renderTo(ref.current);
		}
		return cleanup;
	}, [scene, ref]);
	return ref;
}
