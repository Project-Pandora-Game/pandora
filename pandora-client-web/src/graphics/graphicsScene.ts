import { AbstractRenderer, Application, Container, Filter, InteractionManager, Sprite, Texture } from 'pixi.js';
import * as PixiViewport from 'pixi-viewport';
import { TypedEventEmitter } from '../event';
import { CharacterSize } from 'pandora-common';
import { Observable, ReadonlyObservable } from '../observable';

export class GraphicsScene extends TypedEventEmitter<{ resize: void; }> {
	private readonly _app: Application;
	private readonly _background = new Observable('#1099bb');
	private _destroyed: boolean = false;
	private _backgroundSprite?: Sprite;
	readonly container: PixiViewport.Viewport;
	private element: HTMLElement | undefined;
	private readonly resizeObserver: ResizeObserver;
	protected backgroundFilters: Filter[] = [];

	protected cleanupCalls: (() => void)[] = [];

	get width(): number {
		return this._app.renderer.width;
	}

	get height(): number {
		return this._app.renderer.height;
	}

	get renderer(): AbstractRenderer {
		return this._app.renderer;
	}

	public get destroyed(): boolean {
		return this._destroyed;
	}

	public get background(): ReadonlyObservable<string> {
		return this._background;
	}

	constructor() {
		super();
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this._app = new Application({
			backgroundColor: 0x1099bb,
			resolution: window.devicePixelRatio || 1,
			antialias: true,
		});
		this.container = new PixiViewport.Viewport({
			worldHeight: CharacterSize.HEIGHT,
			worldWidth: CharacterSize.WIDTH,
			interaction: this._app.renderer.plugins.interaction as InteractionManager,
		});
		this.container.sortableChildren = true;
		this._app.stage.addChild(this.container);
	}

	destroy() {
		this.cleanupCalls.reverse().forEach((c) => c());
		this.cleanupCalls = [];
		this.resizeObserver.disconnect();
		this.container.destroy({ children: true });
		this._app.destroy(true, { children: true });
		this.element = undefined;
		this._destroyed = true;
	}

	renderTo(element: HTMLElement): () => void {
		if (this.element !== undefined) {
			this.resizeObserver.unobserve(this.element);
			this._app.resizeTo = window;
			this.element.removeChild(this._app.view);
			this.element = undefined;
		}
		this.element = element;
		element.appendChild(this._app.view);
		this._app.resizeTo = element;
		this.resizeObserver.observe(element);
		this.resize();
		return () => {
			if (this.element === element) {
				this.resizeObserver.unobserve(element);
				this._app.resizeTo = window;
				element.removeChild(this._app.view);
				this.element = undefined;
			}
		};
	}

	resize(center: boolean = true): void {
		if (this.destroyed)
			return;
		this._app.resize();
		const { width, height } = this._app.screen;
		this.container.resize(width, height);
		this.container.clampZoom({
			minScale: Math.min(height / this.container.worldHeight, width / this.container.worldWidth) * 0.2,
			maxScale: 2,
		});
		if (center) {
			this.container.fit();
			this.container.moveCenter(this.container.worldWidth / 2, this.container.worldHeight / 2);
		}
		this.emit('resize', undefined);
	}

	add<T extends Container>(container: T, zIndex: number = 0): T {
		const result = this.container.addChild(container);
		result.zIndex = zIndex;
		return result;
	}

	remove(container: Container): void {
		this.container.removeChild(container);
	}

	setBackgroundFilters(filters: Filter[]) {
		if (this._backgroundSprite) {
			this._backgroundSprite.filters = filters;
		}
		this.backgroundFilters = filters;
	}

	public setBackground(data: string, width?: number, height?: number) {
		if (this.destroyed)
			return;
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(data)) {
			this._backgroundSprite?.destroy();
			this._backgroundSprite = undefined;
			const color = this._app.renderer.backgroundColor = parseInt(data.substring(1, 7), 16);
			if (data.length > 7) {
				this._app.renderer.backgroundAlpha = parseInt(data.substring(7, 9), 16) / 255;
			} else {
				this._app.renderer.backgroundAlpha = 1;
			}
			this._background.value = `#${color.toString(16).padStart(6, '0')}`;
		} else if (/^data:image\/png;base64,[0-9a-zA-Z+/=]+$/i.test(data)) {
			this._background.value = data;
			const img = new Image();
			img.src = data;
			this._setBackgroundTexture(Texture.from(img), width, height);
		} else if (/^https?:\/\/.+$/i.test(data)) {
			this._background.value = data;
			(async () => {
				const texture = await Texture.fromURL(data);
				if (this._background.value === data) {
					this._setBackgroundTexture(texture, width, height);
				}
			})().catch(() => { /** */ });
		} else {
			// eslint-disable-next-line no-console
			console.log('Invalid background data: ' + data);
		}
	}

	private _setBackgroundTexture(texture: Texture, width?: number, height?: number) {
		if (this.destroyed)
			return;
		if (!this._backgroundSprite) {
			this._backgroundSprite = this.add(new Sprite(texture), -1000);
			this._backgroundSprite.filters = this.backgroundFilters;
		} else {
			this._backgroundSprite.texture = texture;
		}
		if (width) {
			this._backgroundSprite.width = width;
		}
		if (height) {
			this._backgroundSprite.height = height;
		}
		this._app.renderer.backgroundColor = 0x000000;
		this._app.renderer.backgroundAlpha = 1;
	}
}
