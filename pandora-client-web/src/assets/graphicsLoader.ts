import { Assert, GetLogger, Logger } from 'pandora-common';
import { BaseTexture, IImageResourceOptions, Resource, Texture, autoDetectResource } from 'pixi.js';
import { PersistentToast } from '../persistentToast';
import { IGraphicsLoader } from './graphicsManager';

/**
 * Interval after which texture load is retried, if the texture is still being requested.
 * Last interval is repeated indefinitely until the load either succeeds or the texture is no longer needed.
 */
const RETRY_INTERVALS = [100, 500, 500, 1000, 1000, 5000];

export const ERROR_TEXTURE = Texture.EMPTY;

type TextureUpdateListener = (texture: Texture<Resource>) => void;

class TextureData {
	public readonly path: string;
	public readonly loader: IGraphicsLoader;
	private readonly logger: Logger;

	private readonly _listeners = new Set<TextureUpdateListener>;

	private _loadedResource: Resource | null = null;
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

	public registerListener(listener: TextureUpdateListener): () => void {
		this._listeners.add(listener);
		this.load();
		return () => {
			this._listeners.delete(listener);
		};
	}

	public load(): void {
		if (this._loadedResource != null || this._pendingLoad)
			return;
		this._pendingLoad = true;

		this.loader.loadResource(this.path)
			.then((resource) => {
				Assert(this._pendingLoad);
				Assert(this._loadedResource == null);
				Assert(this._loadedTexture == null);

				if (this._failedCounter > 0) {
					this.logger.info(`Image '${this.path}' loaded successfully after ${this._failedCounter + 1} tries`);
				}

				// Finish load
				this._loadedResource = resource;
				const texture = new Texture(new BaseTexture(resource, {
					resolution: 1,
				}));
				this._loadedTexture = texture;
				this._failedCounter = 0;
				this._pendingLoad = false;

				// Notify all listeners about load finishing
				this._listeners.forEach((listener) => listener(texture));
			})
			.catch((err) => {
				Assert(this._pendingLoad);
				Assert(this._loadedResource == null);
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
				this._listeners.forEach((listener) => listener(ERROR_TEXTURE));
			});
	}
}

export abstract class GraphicsLoaderBase implements IGraphicsLoader {
	private readonly store = new Map<string, TextureData>();

	private readonly textureLoadingProgress = new PersistentToast();
	protected readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	public getCachedTexture(path: string): Texture | null {
		if (!path)
			return Texture.EMPTY;

		return this.store.get(path)?.loadedTexture ?? null;
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

		return data;
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

	public abstract loadResource(path: string): Promise<Resource>;

	public abstract loadTextFile(path: string): Promise<string>;

	public abstract loadFileArrayBuffer(path: string): Promise<ArrayBuffer>;

	public abstract pathToUrl(path: string): Promise<string>;
}

export class URLGraphicsLoader extends GraphicsLoaderBase {
	public readonly prefix: string;

	constructor(prefix: string = '') {
		super(GetLogger('GraphicsLoader', `[URLGraphicsLoader '${prefix}']`));
		this.prefix = prefix;
	}

	public override loadResource(path: string): Promise<Resource> {
		return autoDetectResource<Resource, IImageResourceOptions>(this.prefix + path, {
			autoLoad: false,
			crossorigin: 'anonymous',
		}).load();
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
