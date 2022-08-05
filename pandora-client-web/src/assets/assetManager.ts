import { Asset, AssetManager, AssetsDefinitionFile, AssetsGraphicsDefinitionFile, GetLogger } from 'pandora-common';
import { Observable } from '../observable';
import { GraphicsManagerInstance, GraphicsManager } from './graphicsManager';
import { URLGraphicsLoader } from './graphicsLoader';

const logger = GetLogger('AssetManager');

export class AssetManagerClient extends AssetManager {
	public readonly assetList = new Observable<Asset[]>([]);

	override load(definitionsHash: string, data: AssetsDefinitionFile): void {
		super.load(definitionsHash, data);
		this.assetList.value = this.getAllAssets();
	}
}

let assetManager: AssetManagerClient | undefined;

export function GetAssetManager(): AssetManagerClient {
	return assetManager ??= new AssetManagerClient();
}

export function OverrideAssetManager(manager: AssetManagerClient) {
	assetManager = manager;
}

let lastGraphicsHash: string | undefined;
let loader!: URLGraphicsLoader;

export function LoadAssetDefinitions(definitionsHash: string, data: AssetsDefinitionFile, source: string): void {
	GetAssetManager().load(definitionsHash, data);
	logger.info(`Loaded asset definitions, version: ${GetAssetManager().definitionsHash}`);

	if (lastGraphicsHash === data.graphicsId)
		return;

	lastGraphicsHash = data.graphicsId;

	loader ??= new URLGraphicsLoader(source);
	loader.loadTextFile(`graphics_${lastGraphicsHash}.json`).then((json) => {
		const graphics = JSON.parse(json) as AssetsGraphicsDefinitionFile;
		GraphicsManagerInstance.value = new GraphicsManager(loader, data.graphicsId, graphics);
		logger.info(`Loaded graphics, version: ${data.graphicsId}`);
	}).catch((err) => {
		logger.error('Failed to load graphics', err);
	});
}
