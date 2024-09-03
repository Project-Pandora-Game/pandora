import { AssetGraphicsDefinition, AssetId, AssetsGraphicsDefinitionFile, PointTemplate, TypedEventEmitter, type ITypedEventEmitter } from 'pandora-common';
import { Texture, type TextureSource } from 'pixi.js';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { Observable, useObservable } from '../observable';
import { AssetGraphics } from './assetGraphics';

export interface IGraphicsLoaderStats {
	inUseTextures: number;
	loadedTextures: number;
	trackedTextures: number;
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

	return async (loader: IGraphicsLoader, { imageFormats }: AssetsGraphicsDefinitionFile): Promise<IGraphicsLoader> => {
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
	private readonly _assetGraphics: Map<AssetId, AssetGraphics> = new Map();
	private readonly _pointTemplates: Map<string, PointTemplate> = new Map();
	private _pointTemplateList: readonly string[] = [];

	public readonly definitionsHash: string;
	public readonly loader: IGraphicsLoader;

	private constructor(loader: IGraphicsLoader, definitionsHash: string, data: AssetsGraphicsDefinitionFile) {
		this.loader = loader;
		this.definitionsHash = definitionsHash;
		this.loadPointTemplates(data.pointTemplates);
		this.loadAssets(data.assets);
	}

	public static async create(loader: IGraphicsLoader, definitionsHash: string, data: AssetsGraphicsDefinitionFile): Promise<GraphicsManager> {
		const newLoader = await TransformGraphicsLoader(loader, data);
		return new GraphicsManager(newLoader, definitionsHash, data);
	}

	public getAllAssetsGraphics(): AssetGraphics[] {
		return [...this._assetGraphics.values()];
	}

	public getAssetGraphicsById(id: AssetId): AssetGraphics | undefined {
		return this._assetGraphics.get(id);
	}

	public get pointTemplateList(): readonly string[] {
		return this._pointTemplateList;
	}

	public getTemplate(name: string): PointTemplate | undefined {
		if (!name)
			return [];

		return this._pointTemplates.get(name);
	}

	private loadAssets(assets: Record<AssetId, AssetGraphicsDefinition>): void {
		// First unload no-longer existing assets
		for (const id of this._assetGraphics.keys()) {
			if (assets[id] === undefined) {
				this._assetGraphics.delete(id);
			}
		}
		// Then load or update all defined assets
		for (const [id, definition] of Object.entries(assets)) {
			if (!id.startsWith('a/')) {
				throw new Error(`Asset without valid prefix: ${id}`);
			}
			let asset = this._assetGraphics.get(id as AssetId);
			if (asset) {
				asset.load(definition);
			} else {
				asset = this.createAssetGraphics(id as AssetId, definition);
				this._assetGraphics.set(id as AssetId, asset);
			}
		}
	}

	private loadPointTemplates(pointTemplates: Record<string, PointTemplate>): void {
		this._pointTemplates.clear();
		for (const [name, template] of Object.entries(pointTemplates)) {
			this._pointTemplates.set(name, template);
		}
		this._pointTemplateList = Array.from(this._pointTemplates.keys());
	}

	protected createAssetGraphics(id: AssetId, data: AssetGraphicsDefinition): AssetGraphics {
		return new AssetGraphics(id, data);
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
