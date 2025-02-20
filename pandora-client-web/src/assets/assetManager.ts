import { Asset, AssetManager, AssetsDefinitionFile, AssetsGraphicsDefinitionFile, GetLogger } from 'pandora-common';
import { GraphicsManagerInstance, GraphicsManager } from './graphicsManager';
import { URLGraphicsLoader } from './graphicsLoader';
import { Observable, useObservable } from '../observable';
import { Immutable } from 'immer';
import { ConfigServerIndex } from '../config/searchArgs';

const logger = GetLogger('AssetManager');

export class AssetManagerClient extends AssetManager {
	public readonly assetList: readonly Asset[];

	constructor(definitionsHash: string, data?: Immutable<AssetsDefinitionFile>) {
		super(definitionsHash, data);

		this.assetList = this.getAllAssets();
	}
}

const assetManager = new Observable<AssetManagerClient>(new AssetManagerClient(''));

export function GetCurrentAssetManager(): AssetManagerClient {
	return assetManager.value;
}

export function useAssetManager(): AssetManagerClient {
	return useObservable(assetManager);
}

export function UpdateAssetManager(manager: AssetManagerClient) {
	assetManager.value = manager;
}

let lastGraphicsHash: string | undefined;
let loader: URLGraphicsLoader | undefined;
let assetsSource: string = '';

export function GetAssetsSourceUrl(): string {
	return assetsSource;
}

export function LoadAssetDefinitions(definitionsHash: string, data: Immutable<AssetsDefinitionFile>, source: string): void {
	// Skip load if asset definition matches the already loaded one
	if (assetManager.value.definitionsHash === definitionsHash) {
		return;
	}

	const manager = new AssetManagerClient(definitionsHash, data);
	UpdateAssetManager(manager);
	logger.info(`Loaded asset definitions, version: ${manager.definitionsHash}`);

	// Update graphics definition
	if (lastGraphicsHash === manager.graphicsId)
		return;

	lastGraphicsHash = data.graphicsId;
	const lastAssetsSource = assetsSource;
	const assetsSourceOptions = source.split(';').map((a) => a.trim());
	assetsSource = assetsSourceOptions[ConfigServerIndex.value % assetsSourceOptions.length];

	if (lastAssetsSource !== assetsSource || loader == null) {
		loader = new URLGraphicsLoader(assetsSource);
	}
	const currentLoader = loader;
	void (async () => {
		try {
			const json = await currentLoader.loadTextFile(`graphics_${lastGraphicsHash}.json`);
			const graphics = JSON.parse(json) as AssetsGraphicsDefinitionFile;
			GraphicsManagerInstance.value = await GraphicsManager.create(currentLoader, data.graphicsId, graphics);
			logger.info(`Loaded graphics, version: ${data.graphicsId}`);
		} catch (err) {
			logger.error('Failed to load graphics', err);
		}
	})();
}

export function DestroyGraphicsLoader(): void {
	if (loader !== undefined) {
		loader.destroy();
		loader = undefined;
	}
}
