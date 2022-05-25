import { Texture } from 'pixi.js';
import { PersistentToast } from '../persistentToast';
import { IGraphicsLoader } from './graphicsManager';

export abstract class GraphicsLoaderBase implements IGraphicsLoader {
	private readonly cache = new Map<string, Texture>();
	private readonly pending = new Map<string, Promise<Texture>>();
	private readonly textureLoadingProgress = new PersistentToast();

	async getTexture(path: string): Promise<Texture> {
		if (!path)
			return Texture.EMPTY;

		let texture = this.cache.get(path);
		if (texture !== undefined)
			return texture;

		let promise = this.pending.get(path);
		if (promise !== undefined)
			return promise;

		promise = this.loadTexture(path);
		this.pending.set(path, promise);
		this.updateLoadingProgressToast();

		try {
			texture = await promise;
		} finally {
			this.pending.delete(path);
			this.updateLoadingProgressToast();
		}

		this.cache.set(path, texture);
		return texture;
	}

	protected updateLoadingProgressToast(): void {
		const inProgress = this.pending.size;
		if (inProgress > 0) {
			this.textureLoadingProgress.show('progress', `Loading ${inProgress} asset${inProgress > 1 ? 's' : ''}...`);
		} else {
			this.textureLoadingProgress.hide();
		}
	}

	protected abstract loadTexture(path: string): Promise<Texture>;

	public abstract loadTextFile(path: string): Promise<string>;
}

export class URLGraphicsLoader extends GraphicsLoaderBase {
	prefix: string;

	constructor(prefix: string = '') {
		super();
		this.prefix = prefix;
	}

	protected override loadTexture(path: string): Promise<Texture> {
		return Promise.resolve(Texture.fromURL(this.prefix + path));
	}

	public loadTextFile(path: string): Promise<string> {
		return fetch(this.prefix + path).then((r) => r.text());
	}
}
