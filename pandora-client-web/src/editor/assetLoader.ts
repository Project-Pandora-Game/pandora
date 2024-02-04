import { AssetsDefinitionFile, AssetsGraphicsDefinitionFile, GetLogger } from 'pandora-common';
import { Resource } from 'pixi.js';
import { GraphicsManager, GraphicsManagerInstance, IGraphicsLoader } from '../assets/graphicsManager';
import { GraphicsLoaderBase, URLGraphicsLoader } from '../assets/graphicsLoader';
import { AssetManagerEditor, EditorAssetManager } from './assets/assetManager';
import { LoadArrayBufferImageResource } from '../graphics/utility';
import { EDITOR_ASSETS_ADDRESS, EDITOR_ASSETS_OFFICIAL_ADDRESS } from '../config/Environment';

export async function LoadAssetsFromFileSystem(): Promise<[AssetManagerEditor, GraphicsManager]> {
	const dirHandle = await showDirectoryPicker();
	if (!dirHandle) {
		throw new Error('No directory selected');
	}

	return Load(new FileSystemGraphicsLoader(dirHandle));
}

export async function LoadAssetsFromAssetDevServer(): Promise<[AssetManagerEditor, GraphicsManager]> {
	return Load(new URLGraphicsLoader(EDITOR_ASSETS_ADDRESS + '/'));
}

export async function LoadAssetsFromOfficialLink(): Promise<[AssetManagerEditor, GraphicsManager]> {
	return Load(new URLGraphicsLoader(EDITOR_ASSETS_OFFICIAL_ADDRESS + '/'));
}

async function Load(loader: IGraphicsLoader): Promise<[AssetManagerEditor, GraphicsManager]> {
	let hash: string;
	try {
		hash = (await loader.loadTextFile('current')).trim();
	} catch (error) {
		throw new Error('Failed to get the assets version.\nIs the target server running and reachable?');

	}
	const assetDefinitions = JSON.parse(await loader.loadTextFile(`assets_${hash}.json`)) as AssetsDefinitionFile;

	const assetManager = EditorAssetManager.loadAssetManager(hash, assetDefinitions);

	const graphicsHash = assetManager.graphicsId;
	const graphicsDefinitions = JSON.parse(await loader.loadTextFile(`graphics_${graphicsHash}.json`)) as AssetsGraphicsDefinitionFile;

	const graphicsManager = new GraphicsManager(loader, graphicsHash, graphicsDefinitions);
	GraphicsManagerInstance.value = graphicsManager;

	return [assetManager, graphicsManager];
}

async function ReadFile<T extends boolean>(dir: FileSystemDirectoryHandle, path: string, asText: T): Promise<T extends true ? string : ArrayBuffer> {
	const fileHandle = await dir.getFileHandle(path);
	const file = await fileHandle.getFile();
	return await (asText ? file.text() : file.arrayBuffer()) as T extends true ? string : ArrayBuffer;
}

class FileSystemGraphicsLoader extends GraphicsLoaderBase {
	private readonly _handle: FileSystemDirectoryHandle;

	constructor(handle: FileSystemDirectoryHandle) {
		super(GetLogger('GraphicsLoader', `[FileSystemGraphicsLoader]`));
		this._handle = handle;
	}

	public override async loadResource(path: string): Promise<Resource> {
		return LoadArrayBufferImageResource(await ReadFile(this._handle, path, false));
	}

	public loadTextFile(path: string): Promise<string> {
		return this.monitorProgress(ReadFile(this._handle, path, true));
	}

	public loadFileArrayBuffer(path: string): Promise<ArrayBuffer> {
		return this.monitorProgress(ReadFile(this._handle, path, false));
	}

	public pathToUrl(path: string): Promise<string> {
		const prefix = `data:${FileExtensionToFormat(path)};base64,`;
		return this.monitorProgress(async () => {
			const buffer = await ReadFile(this._handle, path, false);
			return prefix + btoa(String.fromCharCode(...new Uint8Array(buffer)));
		});
	}
}

function FileExtensionToFormat(fileName: string): string {
	const index = fileName.lastIndexOf('.');
	if (index === -1) {
		throw new Error(`Invalid file name: ${fileName}`);
	}
	const extension = fileName.substring(index + 1).toLowerCase().trim();
	switch (extension) {
		case 'png':
		case 'jpeg':
		case 'webp':
		case 'avif':
		case 'gif':
			return `image/${extension}`;
		case 'svg':
			return 'image/svg+xml';
		case 'jpg':
			return 'image/jpeg';
		default:
			throw new Error(`Unknown file extension: ${extension}`);
	}
}
