import { AssetsDefinitionFile, GraphicsDefinitionFileSchema, GraphicsSourceDefinitionFileSchema } from 'pandora-common';
import { URLGraphicsLoader } from '../assets/graphicsLoader.ts';
import { GraphicsManager, GraphicsManagerInstance, IGraphicsLoader } from '../assets/graphicsManager.ts';
import { EDITOR_ASSETS_ADDRESS, EDITOR_ASSETS_OFFICIAL_ADDRESS } from '../config/Environment.ts';
import { AssetManagerEditor, EditorAssetManager } from './assets/assetManager.ts';
import { EditorAssetGraphicsManager } from './assets/editorAssetGraphicsManager.ts';

export async function LoadAssetsFromAssetDevServer(): Promise<AssetManagerEditor> {
	return Load(new URLGraphicsLoader(EDITOR_ASSETS_ADDRESS + '/'));
}

export async function LoadAssetsFromOfficialLink(): Promise<AssetManagerEditor> {
	return Load(new URLGraphicsLoader(EDITOR_ASSETS_OFFICIAL_ADDRESS + '/'));
}

async function Load(loader: IGraphicsLoader): Promise<AssetManagerEditor> {
	let hash: string;
	try {
		hash = (await loader.loadTextFile('current')).trim();
	} catch (_error) {
		throw new Error('Failed to get the assets version.\nIs the target server running and reachable?');

	}
	const assetDefinitions = JSON.parse(await loader.loadTextFile(`assets_${hash}.json`)) as AssetsDefinitionFile;

	const assetManager = EditorAssetManager.loadAssetManager(hash, assetDefinitions);

	const graphicsSourceHash = assetManager.graphicsSourceId;
	const graphicsSourceDefinitions = GraphicsSourceDefinitionFileSchema.parse(JSON.parse(await loader.loadTextFile(`graphicsSource_${graphicsSourceHash}.json`)));

	const graphicsHash = assetManager.graphicsId;
	const graphicsDefinitions = GraphicsDefinitionFileSchema.parse(JSON.parse(await loader.loadTextFile(`graphics_${graphicsHash}.json`)));

	// Load initial version of runtime graphics
	const graphicsManager = await GraphicsManager.create(loader, graphicsHash, graphicsDefinitions);
	GraphicsManagerInstance.value = graphicsManager;

	// Load graphics source definitions for editor
	EditorAssetGraphicsManager.loadNewOriginalDefinitions(graphicsSourceDefinitions, graphicsDefinitions);

	return assetManager;
}
