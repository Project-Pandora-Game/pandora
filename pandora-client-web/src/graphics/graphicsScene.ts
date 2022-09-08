import { Application, Container, InteractionManager, Sprite, Texture } from 'pixi.js';
import * as PixiViewport from 'pixi-viewport';
import { useRef, useEffect, useLayoutEffect } from 'react';
import { TypedEventEmitter } from '../event';
import { CharacterSize } from 'pandora-common';
import { Character } from '../character/character';
import { GraphicsCharacter } from './graphicsCharacter';
import { useObservable } from '../observable';
import { GraphicsManagerInstance } from '../assets/graphicsManager';

export class GraphicsScene extends TypedEventEmitter<{ resize: void; }> {
	private readonly _app: Application;
	readonly container: PixiViewport.Viewport;
	private element: HTMLElement | undefined;
	private readonly resizeObserver: ResizeObserver;

	get width(): number {
		return this._app.renderer.width;
	}

	get height(): number {
		return this._app.renderer.height;
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
		this._app.resize();
		const { width, height } = this._app.screen;
		this.container.resize(width, height);
		this.container.clampZoom({
			minScale: Math.min(height / this.container.worldHeight, width / this.container.worldWidth) * 0.9,
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

	private _background = '';
	private _backgroundSprite?: Sprite;
	get background(): string {
		if (this._background) return this.background;
		const { backgroundColor } = this._app.renderer;
		return `#${backgroundColor.toString(16).padStart(6, '0')}`;
	}
	public setBackground(data: string, width?: number, height?: number) {
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(data)) {
			this._background = '';
			this._backgroundSprite?.destroy();
			this._backgroundSprite = undefined;
			this._app.renderer.backgroundColor = parseInt(data.substring(1, 7), 16);
			if (data.length > 7) {
				this._app.renderer.backgroundAlpha = parseInt(data.substring(7, 9), 16) / 255;
			} else {
				this._app.renderer.backgroundAlpha = 1;
			}
		} else if (/^data:image\/png;base64,[0-9a-zA-Z+/=]+$/i.test(data)) {
			this._background = data;
			const img = new Image();
			img.src = data;
			const texture = Texture.from(img);
			this._backgroundSprite = this.add(new Sprite(texture), -1000);
			if (width) {
				this._backgroundSprite.width = width;
			}
			if (height) {
				this._backgroundSprite.height = height;
			}
			this._app.renderer.backgroundColor = 0x000000;
			this._app.renderer.backgroundAlpha = 1;
		} else if (/^https?:\/\/.+$/i.test(data)) {
			this._background = data;
			(async () => {
				const texture = await Texture.fromURL(data);
				this._backgroundSprite = this.add(new Sprite(texture), -1000);
				if (width) {
					this._backgroundSprite.width = width;
				}
				if (height) {
					this._backgroundSprite.height = height;
				}
				this._app.renderer.backgroundColor = 0x000000;
				this._app.renderer.backgroundAlpha = 1;
			})().catch(() => { /** */ });
		} else {
			// eslint-disable-next-line no-console
			console.log('Invalid background data: ' + data);
		}
	}
}

export function useGraphicsScene<T extends HTMLElement>(scene: GraphicsScene): React.RefObject<T> {
	const ref = useRef<T>(null);
	useEffect(() => {
		if (ref.current) {
			return scene.renderTo(ref.current);
		}
		return undefined;
	}, [scene, ref]);
	return ref;
}

export function useGraphicsSceneCharacter<T extends HTMLElement>(scene: GraphicsScene, character: Character): React.RefObject<T> {
	const ref = useRef<T>(null);
	const manager = useObservable(GraphicsManagerInstance);

	useLayoutEffect(() => {
		if (!manager)
			return;
		const gCharacter = new GraphicsCharacter(character);
		gCharacter.useGraphics(manager.getAssetGraphicsById.bind(manager));
		scene.add(gCharacter);
		return () => {
			scene.remove(gCharacter);
		};
	}, [scene, character, manager]);

	useEffect(() => {
		if (ref.current) {
			return scene.renderTo(ref.current);
		}
		return undefined;
	}, [scene, ref]);

	return ref;
}
