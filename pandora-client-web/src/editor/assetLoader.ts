import { AssetsDefinitionFile, AssetsGraphicsDefinitionFile } from 'pandora-common';
import { Texture } from 'pixi.js';
import { GraphicsManager, GraphicsManagerInstance, IGraphicsLoader } from '../assets/graphicsManager';
import { GraphicsLoaderBase, URLGraphicsLoader } from '../assets/graphicsLoader';
import { GetAssetManagerEditor } from './assets/assetManager';
import { LoadArrayBufferTexture } from '../graphics/utility';

export async function LoadAssetsFromFileSystem(): Promise<GraphicsManager> {
	const dirHandle = await showDirectoryPicker();
	if (!dirHandle) {
		throw new Error('No directory selected');
	}

	return Load(new FileSystemGraphicsLoader(dirHandle));
}

export async function LoadAssetsFromDirectLink(): Promise<GraphicsManager> {
	const prefix = `${location.origin}/pandora-assets`;

	return Load(new URLGraphicsLoader(prefix + '/'));
}

async function Load(loader: IGraphicsLoader): Promise<GraphicsManager> {
	const hash = (await loader.loadTextFile('current')).trim();
	const assetDefinitions = JSON.parse(await loader.loadTextFile(`assets_${hash}.json`)) as AssetsDefinitionFile;

	const assetManager = GetAssetManagerEditor();
	assetManager.load(hash, assetDefinitions);

	const graphicsHash = assetManager.graphicsId;
	const graphicsDefinitions = JSON.parse(await loader.loadTextFile(`graphics_${graphicsHash}.json`)) as AssetsGraphicsDefinitionFile;

	const graphicsManager = new GraphicsManager(loader, graphicsHash, graphicsDefinitions);
	GraphicsManagerInstance.value = graphicsManager;

	return graphicsManager;
}

async function ReadFile<T extends boolean>(dir: FileSystemDirectoryHandle, path: string, asText: T): Promise<T extends true ? string : ArrayBuffer> {
	const fileHandle = await dir.getFileHandle(path);
	const file = await fileHandle.getFile();
	return await (asText ? file.text() : file.arrayBuffer()) as T extends true ? string : ArrayBuffer;
}

class FileSystemGraphicsLoader extends GraphicsLoaderBase {
	private readonly _handle: FileSystemDirectoryHandle;

	constructor(handle: FileSystemDirectoryHandle) {
		super();
		this._handle = handle;
	}

	protected override async loadTexture(path: string): Promise<Texture> {
		return LoadArrayBufferTexture(await ReadFile(this._handle, path, false));
	}

	public loadTextFile(path: string): Promise<string> {
		return this.monitorProgress(ReadFile(this._handle, path, true));
	}

	public loadFileArrayBuffer(path: string): Promise<ArrayBuffer> {
		return this.monitorProgress(ReadFile(this._handle, path, false));
	}
}
