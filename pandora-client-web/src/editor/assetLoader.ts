import { AssetsDefinitionFile, AssetsGraphicsDefinitionFile } from 'pandora-common';
import { GraphicsManager, GraphicsManagerInstance, IGraphicsLoader } from '../assets/graphicsManager';
import { URLGraphicsLoader } from '../assets/graphicsLoader';
import { AssetManagerEditor, EditorAssetManager } from './assets/assetManager';
import { EDITOR_ASSETS_ADDRESS, EDITOR_ASSETS_OFFICIAL_ADDRESS } from '../config/Environment';

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
	} catch (_error) {
		throw new Error('Failed to get the assets version.\nIs the target server running and reachable?');

	}
	const assetDefinitions = JSON.parse(await loader.loadTextFile(`assets_${hash}.json`)) as AssetsDefinitionFile;

	const assetManager = EditorAssetManager.loadAssetManager(hash, assetDefinitions);

	const graphicsHash = assetManager.graphicsId;
	const graphicsDefinitions = JSON.parse(await loader.loadTextFile(`graphics_${graphicsHash}.json`)) as AssetsGraphicsDefinitionFile;

	const graphicsManager = await GraphicsManager.create(loader, graphicsHash, graphicsDefinitions);
	GraphicsManagerInstance.value = graphicsManager;

	return [assetManager, graphicsManager];
}
