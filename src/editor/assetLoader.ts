import { AssetsDefinitionFile } from 'pandora-common';
import { GetTextureLoader, OverrideTextureLoader, TextureLoader } from '../graphics/textureLoader';
import { GetAssetManagerEditor } from './assets/assetManager';
import { GetAssetStateManagerEditor } from './graphics/stateManager';
import { Texture } from 'pixi.js';

export async function LoadAssetsFromFileSystem(): Promise<void> {
	const dirHandle = await showDirectoryPicker();
	if (!dirHandle) {
		throw new Error('No directory selected');
	}
	const hash = (await ReadFile(dirHandle, 'current', true)).trim();
	const json = await ReadFile(dirHandle, `assets_${hash}.json`, true);

	OverrideTextureLoader(new FileSystemTextureLoader(dirHandle));

	Load(hash, json);
}

export async function LoadAssetsFromDirectLink(): Promise<void> {
	const prefix = `${location.origin}/pandora-assets`;
	const hash = await fetch(`${prefix}/current`).then((r) => r.text());
	const json = await fetch(`${prefix}/assets_${hash}.json`).then((r) => r.text());

	GetTextureLoader().prefix = prefix + '/';

	Load(hash, json);
}

function Load(hash: string, json: string) {
	const store = GetAssetManagerEditor();
	GetAssetStateManagerEditor();
	store.load(hash, JSON.parse(json) as AssetsDefinitionFile);
}

async function ReadFile<T extends boolean>(dir: FileSystemDirectoryHandle, path: string, asText: T): Promise<T extends true ? string : ArrayBuffer> {
	const fileHandle = await dir.getFileHandle(path);
	const file = await fileHandle.getFile();
	return await (asText ? file.text() : file.arrayBuffer()) as T extends true ? string : ArrayBuffer;
}

class FileSystemTextureLoader extends TextureLoader {
	private readonly _handle: FileSystemDirectoryHandle;
	private readonly _cache = new Map<string, Texture>();

	constructor(handle: FileSystemDirectoryHandle) {
		super();
		this._handle = handle;
	}

	override async loadTexture(path: string): Promise<Texture> {
		path = this.prefix + path;
		const cached = this._cache.get(path);
		if (cached) {
			return cached;
		}
		const blob = new Blob([await ReadFile(this._handle, path, false)], { type: 'image/png' });
		return await new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => {
				const texture = Texture.from(image);
				this._cache.set(path, texture);
				URL.revokeObjectURL(image.src);
				resolve(texture);
			};
			image.onerror = reject;
			image.src = URL.createObjectURL(blob);
		});
	}
}
