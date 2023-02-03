import { AssetsDefinitionFile, AssetsGraphicsDefinitionFile, GetLogger } from 'pandora-common';
import { Texture } from 'pixi.js';
import { GraphicsManager, GraphicsManagerInstance, IGraphicsLoader } from '../assets/graphicsManager';
import { GraphicsLoaderBase, URLGraphicsLoader } from '../assets/graphicsLoader';
import { GetAssetManagerEditor } from './assets/assetManager';
import { LoadArrayBufferTexture } from '../graphics/utility';
import { EDITOR_ASSETS_ADDRESS } from '../config/Environment';

export async function LoadAssetsFromFileSystem(): Promise<GraphicsManager> {
	const dirHandle = await showDirectoryPicker();
	if (!dirHandle) {
		throw new Error('No directory selected');
	}

	return Load(new FileSystemGraphicsLoader(dirHandle));
}

export async function LoadAssetsFromAssetDevServer(): Promise<GraphicsManager> {
	return Load(new URLGraphicsLoader(EDITOR_ASSETS_ADDRESS + '/'));
}

export async function LoadAssetsFromOfficialLink(): Promise<GraphicsManager> {
	return Load(new URLGraphicsLoader('https://project-pandora.com/pandora-assets/'));
}

async function Load(loader: IGraphicsLoader): Promise<GraphicsManager> {
	let hash: string;
	try {
		hash = (await loader.loadTextFile('current')).trim();
	} catch (error) {
		throw new Error('Failed to get the assets version.\nIs the target server running and reachable?');

	}
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
		super(GetLogger('GraphicsLoader', `[FileSystemGraphicsLoader]`));
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

	public loadAsUrl(path: string): Promise<string> {
		let prefix = 'data:';
		if (path.endsWith('.png')) {
			prefix += 'image/png;base64,';
		} else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
			prefix += 'image/jpeg;base64,';
		} else if (path.endsWith('.gif')) {
			prefix += 'image/gif;base64,';
		} else if (path.endsWith('.webp')) {
			prefix += 'image/webp;base64,';
		} else if (path.endsWith('.svg')) {
			prefix += 'image/svg+xml;base64,';
		} else if (path.endsWith('.avif')) {
			prefix += 'image/avif;base64,';
		} else {
			throw new Error(`Unknown file type: ${path}`);
		}
		return this.monitorProgress(async () => {
			const buffer = await ReadFile(this._handle, path, false);
			return prefix + btoa(String.fromCharCode(...new Uint8Array(buffer)));
		});
	}
}
