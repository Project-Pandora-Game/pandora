import { Immutable } from 'immer';
import { Asset, AssetManager, AssetsDefinitionFile, GetLogger, GraphicsDefinitionFileSchema } from 'pandora-common';
import { toast } from 'react-toastify';
import { Column } from '../components/common/container/container.tsx';
import { DEVELOPMENT } from '../config/Environment.ts';
import { ConfigServerIndex } from '../config/searchArgs.ts';
import { Observable, useObservable } from '../observable.ts';
import { TOAST_OPTIONS_INFO } from '../persistentToast.ts';
import { URLGraphicsLoader } from './graphicsLoader.ts';
import { GraphicsManager, GraphicsManagerInstance } from './graphicsManager.ts';

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
	const currentHash = assetManager.value.definitionsHash;
	if (currentHash === definitionsHash) {
		return;
	}

	const manager = new AssetManagerClient(definitionsHash, data);
	UpdateAssetManager(manager);
	logger.info(`Loaded asset definitions, version: ${manager.definitionsHash}`);
	// Notify user if we already had some and asset definition updated
	if (currentHash) {
		toast((
			<Column>
				<strong>Loaded new asset updates</strong>
				{ DEVELOPMENT ? '' : (<span>A list of changes can be found on Pandora's Discord.</span>) }
			</Column>
		), TOAST_OPTIONS_INFO);
	}

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
			const graphics = GraphicsDefinitionFileSchema.parse(JSON.parse(json));
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
