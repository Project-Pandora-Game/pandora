import { freeze, type Immutable } from 'immer';
import {
	AssetGraphicsDefinition,
	AssetId,
	GraphicsDefinitionFile,
	PointTemplate,
	TypedEventEmitter,
	type InversePosingHandle,
	type ITypedEventEmitter,
} from 'pandora-common';
import { Texture, type TextureSource } from 'pixi.js';
import { useEffect, useState } from 'react';
import * as z from 'zod';
import { BrowserStorage } from '../browserStorage.ts';
import { Observable, useObservable } from '../observable.ts';

export interface IGraphicsLoaderStats {
	inUseTextures: number;
	loadedTextures: number;
	trackedTextures: number;
	/** Number of pixels summed across all loaded textures */
	loadedPixels: number;
	/** Size in bytes of loaded textures, estimated. */
	estLoadedSize: number;
}

export type IGraphicsLoaderEvents = {
	storeChaged: void;
};

export type TextureUpdateListener = (texture: Texture, lock: () => (() => void)) => void;

export interface IGraphicsLoader extends ITypedEventEmitter<IGraphicsLoaderEvents> {
	getCachedTexture(path: string): Texture | null;
	/**
	 * Requests a texture to be loaded and marks the texture as in-use
	 * @param path - The requested texture
	 * @param listener - Listener for when the texture is successfully loaded
	 * @returns A callback to release the texture
	 */
	useTexture(path: string, listener: TextureUpdateListener): () => void;
	loadTextureSource(path: string): Promise<TextureSource>;
	loadTextFile(path: string): Promise<string>;
	loadFileArrayBuffer(path: string, type?: string): Promise<ArrayBuffer>;
	/**
	 * Gets source url of the path
	 *  - for remote files it will return the original url
	 *  - for local files it will return a base64 data url
	 * @param path - Path to file
	 */
	pathToUrl(path: string): Promise<string>;

	/** Garbage collect unused textures */
	gc(): void;

	/** Collects current statistics from the graphics loader */
	getDebugStats(): IGraphicsLoaderStats;
}

class AlternateImageFormatGraphicsLoader extends TypedEventEmitter<IGraphicsLoaderEvents> implements IGraphicsLoader {
	private readonly _loader: IGraphicsLoader;
	private readonly _acceptedFormats: readonly string[];
	private readonly _newFormat: string;
	private readonly _suffix: string;

	constructor(loader: IGraphicsLoader, acceptedFormats: readonly string[], newFormat: string, suffix: string) {
		super();
		this._loader = loader;
		this._acceptedFormats = acceptedFormats.map((f) => `.${f}`);
		this._newFormat = newFormat;
		this._suffix = suffix ? `_${suffix}` : '';

		this._loader.on('storeChaged', () => {
			this.emit('storeChaged', undefined);
		});
	}

	private _transformPath(path: string): string {
		for (const format of this._acceptedFormats) {
			if (path.endsWith(format)) {
				return path.slice(0, -format.length) + this._suffix + '.' + this._newFormat;
			}
		}
		return path;
	}

	public getCachedTexture(path: string): Texture | null {
		return this._loader.getCachedTexture(this._transformPath(path));
	}

	public useTexture(path: string, listener: TextureUpdateListener): () => void {
		return this._loader.useTexture(this._transformPath(path), listener);
	}

	public loadTextureSource(path: string): Promise<TextureSource> {
		return this._loader.loadTextureSource(this._transformPath(path));
	}

	public loadTextFile(path: string): Promise<string> {
		return this._loader.loadTextFile(this._transformPath(path));
	}

	public loadFileArrayBuffer(path: string, type?: string): Promise<ArrayBuffer> {
		return this._loader.loadFileArrayBuffer(this._transformPath(path), type);
	}

	public pathToUrl(path: string): Promise<string> {
		return this._loader.pathToUrl(this._transformPath(path));
	}

	public gc(): void {
		this._loader.gc();
	}

	public getDebugStats(): IGraphicsLoaderStats {
		return this._loader.getDebugStats();
	}
}

const TransformGraphicsLoader = (() => {
	const acceptedFormats = ['png', 'jpg', 'jpeg'];
	const formatTests: Readonly<Record<string, string>> = {
		'avif': 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAPBtZXRhAAAAAAAAAChoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAbGliYXZpZgAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAEUAAAAFQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABoaXBycAAAAElpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAOcGl4aQAAAAABCAAAAAxhdjFDgQAcAAAAABNjb2xybmNseAABAAEAAQAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB1tZGF0EgAKBxgADlgICAkyCB/xgAAghQm0',
		'webp': 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAEX/I/of',
	};

	const support = BrowserStorage.create('imageFormatSupport', { supported: [], unsupported: [] }, z.object({
		supported: z.array(z.string()),
		unsupported: z.array(z.string()),
	}));

	return async (loader: IGraphicsLoader, { imageFormats }: Immutable<GraphicsDefinitionFile>): Promise<IGraphicsLoader> => {
		const promises: Promise<IGraphicsLoader | null>[] = [];
		for (const [format, suffix] of Object.entries(imageFormats)) {
			const test = formatTests[format];
			if (!test) {
				continue;
			}
			if (support.value.supported.includes(format)) {
				return new AlternateImageFormatGraphicsLoader(loader, acceptedFormats, format, suffix);
			}
			if (support.value.unsupported.includes(format)) {
				continue;
			}
			promises.push(new Promise((resolve) => {
				const image = new Image();
				image.onload = () => {
					support.value = {
						supported: [...support.value.supported, format],
						unsupported: support.value.unsupported,
					};
					resolve(new AlternateImageFormatGraphicsLoader(loader, acceptedFormats, format, suffix));
				};
				image.onerror = () => {
					support.value = {
						supported: support.value.supported,
						unsupported: [...support.value.unsupported, format],
					};
					resolve(null);
				};
				image.src = test;
			}));
		}
		for (const res of await Promise.allSettled(promises)) {
			if (res.status === 'fulfilled' && res.value) {
				return res.value;
			}
		}
		return loader;
	};
})();

export class GraphicsManager {
	public readonly definitionsHash: string;
	public readonly loader: IGraphicsLoader;

	public readonly assetGraphics: Immutable<Partial<Record<AssetId, AssetGraphicsDefinition>>>;
	public readonly pointTemplates: ReadonlyMap<string, Immutable<PointTemplate>>;
	/** UI handles used for inverse kinematic posing of the character. */
	public readonly inversePosingHandles: Immutable<InversePosingHandle[]>;

	constructor(loader: IGraphicsLoader, definitionsHash: string, data: Immutable<GraphicsDefinitionFile>) {
		this.loader = loader;
		this.definitionsHash = definitionsHash;
		// Load point templates
		const pointTemplates = new Map<string, Immutable<PointTemplate>>();
		for (const [name, template] of Object.entries(freeze(data.pointTemplates, true))) {
			pointTemplates.set(name, template);
		}
		this.pointTemplates = pointTemplates;
		// Load assets
		this.assetGraphics = freeze(data.assets, true);
		// Load the rest
		this.inversePosingHandles = freeze(data.inversePosingHandles, true);
	}

	public static async create(loader: IGraphicsLoader, definitionsHash: string, data: Immutable<GraphicsDefinitionFile>): Promise<GraphicsManager> {
		const newLoader = await TransformGraphicsLoader(loader, data);
		return new GraphicsManager(newLoader, definitionsHash, data);
	}

	public getTemplate(name: string): Immutable<PointTemplate> | undefined {
		if (!name)
			return [];

		return this.pointTemplates.get(name);
	}
}

export const GraphicsManagerInstance = new Observable<GraphicsManager | null>(null);

export function useGraphicsUrl(path?: string): string | undefined {
	const graphicsManger = useObservable(GraphicsManagerInstance);
	const [graphicsUrl, setGraphicsUrl] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!path || !graphicsManger) {
			setGraphicsUrl(undefined);
			return;
		}
		graphicsManger.loader.pathToUrl(path)
			.then(setGraphicsUrl)
			.catch(() => setGraphicsUrl(undefined));
	}, [path, graphicsManger]);

	return graphicsUrl;
}
