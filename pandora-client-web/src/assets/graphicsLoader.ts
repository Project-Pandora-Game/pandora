import { noop } from 'lodash-es';
import { Assert, GetLogger, Logger, TypedEventEmitter } from 'pandora-common';
import { ImageSource, loadImageBitmap, Texture, TextureSource, WorkerManager } from 'pixi.js';
import { PersistentToast } from '../persistentToast.ts';
import { IGraphicsLoader, type IGraphicsLoaderEvents, type IGraphicsLoaderStats, type TextureUpdateListener } from './graphicsManager.ts';

/**
 * Interval after which texture load is retried, if the texture is still being requested.
 * Last interval is repeated indefinitely until the load either succeeds or the texture is no longer needed.
 */
const RETRY_INTERVALS = [100, 500, 500, 1000, 1000, 5000];

export const ERROR_TEXTURE = Texture.EMPTY;

class TextureData {
	public readonly path: string;
	public readonly loader: IGraphicsLoader;
	private readonly logger: Logger;

	private readonly _listeners = new Set<TextureUpdateListener>;
	private _locks: number = 0;

	private _loadedTextureSource: TextureSource | null = null;
	private _loadedTexture: Texture | null = null;
	public get loadedTexture(): Texture | null {
		return this._loadedTexture;
	}

	private _pendingLoad: boolean = false;
	private _failedCounter: number = 0;

	constructor(path: string, loader: IGraphicsLoader, logger: Logger) {
		this.path = path;
		this.loader = loader;
		this.logger = logger;
	}

	public isInUse(): boolean {
		return this._pendingLoad || this._locks > 0 || this._listeners.size > 0;
	}

	public registerListener(listener: TextureUpdateListener): () => void {
		this._listeners.add(listener);
		this.load();
		return () => {
			this._listeners.delete(listener);
		};
	}

	private _lock(): (() => void) {
		let locked = true;
		this._locks++;

		return () => {
			if (locked) {
				locked = false;
				this._locks--;
			}
		};
	}

	public load(): void {
		if (this._loadedTextureSource != null || this._pendingLoad)
			return;
		this._pendingLoad = true;

		this.loader.loadTextureSource(this.path)
			.then((source) => {
				Assert(this._pendingLoad);
				Assert(this._loadedTextureSource == null);
				Assert(this._loadedTexture == null);

				if (this._failedCounter > 0) {
					this.logger.info(`Image '${this.path}' loaded successfully after ${this._failedCounter + 1} tries`);
				}

				// Finish load
				this._loadedTextureSource = source;
				source.autoGarbageCollect = false;
				const texture = new Texture({
					source,
					label: this.path,
				});
				this._loadedTexture = texture;
				this._failedCounter = 0;
				this._pendingLoad = false;

				// Notify all listeners about load finishing
				this._listeners.forEach((listener) => listener(texture, this._lock.bind(this)));
			})
			.catch((err) => {
				Assert(this._pendingLoad);
				Assert(this._loadedTextureSource == null);
				Assert(this._loadedTexture == null);

				this._failedCounter++;
				const shouldRetry = this._listeners.size > 0;

				if (shouldRetry) {
					const retryTimer = RETRY_INTERVALS[Math.min(this._failedCounter, RETRY_INTERVALS.length) - 1];
					this.logger.warning(`Failed to load image '${this.path}', will retry after ${retryTimer}ms\n`, err);

					setTimeout(() => {
						this._pendingLoad = false;
						this.load();
					}, retryTimer);
				} else {
					this.logger.error(`Failed to load image '${this.path}', will not retry\n`, err);
					this._pendingLoad = false;
				}

				// Send an error texture to all listeners
				this._listeners.forEach((listener) => listener(ERROR_TEXTURE, () => noop));
			});
	}

	public destroy() {
		Assert(!this.isInUse());

		const resource: unknown = this._loadedTextureSource?.resource;

		if (this._loadedTexture != null) {
			this._loadedTexture.destroy(true);
			this._loadedTexture = null;
		}

		if (this._loadedTextureSource != null) {
			this._loadedTextureSource.destroy();
			this._loadedTextureSource = null;
		}

		// Cleanup the resource specially if it is an ImageBitmap
		if (!!resource && resource instanceof ImageBitmap) {
			resource.close();
		}
	}
}

export abstract class GraphicsLoaderBase extends TypedEventEmitter<IGraphicsLoaderEvents> implements IGraphicsLoader {
	private readonly store = new Map<string, TextureData>();

	private readonly textureLoadingProgress = new PersistentToast();
	protected readonly logger: Logger;

	constructor(logger: Logger) {
		super();
		this.logger = logger;
	}

	public getCachedTexture(path: string): Texture | null {
		if (!path)
			return Texture.EMPTY;

		return this.store.get(path)?.loadedTexture ?? null;
	}

	public getTexture(path: string): TextureData {
		return this._initTexture(path);
	}

	public useTexture(path: string, listener: TextureUpdateListener): () => void {
		return this._initTexture(path).registerListener(listener);
	}

	private _initTexture(path: string): TextureData {
		let data: TextureData | undefined = this.store.get(path);
		if (data != null)
			return data;

		data = new TextureData(path, this, this.logger);
		this.store.set(path, data);

		data.load();

		this.emit('storeChaged', undefined);

		return data;
	}

	public gc(): void {
		let unloaded = 0;
		for (const [k, texture] of this.store) {
			if (!texture.isInUse()) {
				texture.destroy();
				this.store.delete(k);
				unloaded++;
			}
		}

		this.logger.verbose(`Finished textures GC, ${unloaded} textures unloaded, ${this.store.size} in use`);

		if (unloaded > 0) {
			this.emit('storeChaged', undefined);
		}
	}

	public getDebugStats(): IGraphicsLoaderStats {
		const result: IGraphicsLoaderStats = {
			inUseTextures: 0,
			loadedTextures: 0,
			trackedTextures: this.store.size,
			loadedPixels: 0,
			estLoadedSize: 0,
		};

		for (const texture of this.store.values()) {
			if (texture.isInUse()) {
				result.inUseTextures++;
			}
			if (texture.loadedTexture != null) {
				result.loadedTextures++;
				const pixels = texture.loadedTexture.width * texture.loadedTexture.height;
				result.loadedPixels += pixels;
				// HACK: Assume all our textures are RGBA8888 for now
				result.estLoadedSize += pixels * 4;
			}
		}

		return result;
	}

	public destroy(): void {
		for (const [k, texture] of this.store) {
			if (!texture.isInUse()) {
				texture.destroy();
				this.store.delete(k);
			} else {
				this.logger.warning('Textue is still in use during unload:', k);
			}
		}

		this.emit('storeChaged', undefined);
	}

	private readonly _pendingPromises = new Set<Promise<unknown>>();
	protected monitorProgress<T>(promiseFactory: Promise<T> | (() => Promise<T>)): Promise<T> {
		let promise = typeof promiseFactory === 'function' ? promiseFactory() : promiseFactory;
		this._pendingPromises.add(promise);
		promise = promise.finally(() => {
			this._pendingPromises.delete(promise);
			this.updateLoadingProgressToast();
		});
		this.updateLoadingProgressToast();
		return promise;
	}

	private updateLoadingProgressToast(): void {
		// TODO (FIX ME): The toast is disabled, because it has tendency to get stuck on the screen
		const inProgress = this._pendingPromises.size;
		if (inProgress > 0) {
			// this.textureLoadingProgress.show('progress', `Loading ${inProgress} asset${inProgress > 1 ? 's' : ''}...`);
		} else {
			// this.textureLoadingProgress.hide();
		}
	}

	public abstract loadTextureSource(path: string): Promise<TextureSource>;

	public abstract loadTextFile(path: string): Promise<string>;

	public abstract loadFileArrayBuffer(path: string): Promise<ArrayBuffer>;

	public abstract pathToUrl(path: string): Promise<string>;
}

export class URLGraphicsLoader extends GraphicsLoaderBase {
	public readonly prefix: string;

	constructor(prefix: string = '') {
		super(GetLogger('GraphicsLoader', `[URLGraphicsLoader '${prefix}']`));
		// Use full URL, as service worker fetch requires it
		this.prefix = prefix.startsWith('/') ? (window.location.origin + prefix) : prefix;
	}

	public override async loadTextureSource(path: string): Promise<TextureSource> {
		const url = this.prefix + path;
		let src: HTMLImageElement | ImageBitmap;

		if (typeof createImageBitmap === 'function') {
			if (await WorkerManager.isImageBitmapSupported()) {
				src = await WorkerManager.loadImageBitmap(url);
			} else {
				src = await loadImageBitmap(url);
			}
		} else {
			src = await new Promise((resolve, reject) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = () => {
					resolve(img);
				};
				img.onerror = reject;
				img.src = url;
			});
		}

		return new ImageSource({
			resource: src,
			alphaMode: 'premultiply-alpha-on-upload',
			resolution: 1,
		});
	}

	public override loadTextFile(path: string): Promise<string> {
		return this.monitorProgress(fetch(this.prefix + path).then((r) => r.text()));
	}

	public override loadFileArrayBuffer(path: string): Promise<ArrayBuffer> {
		return this.monitorProgress(fetch(this.prefix + path).then((r) => r.arrayBuffer()));
	}

	public override pathToUrl(path: string): Promise<string> {
		return Promise.resolve(this.prefix + path);
	}
}
