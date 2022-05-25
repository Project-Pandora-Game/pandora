import { Asset, AssetManager, AssetsDefinitionFile, GetLogger } from 'pandora-common';
import { Observable } from '../observable';

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

export function LoadAssetDefinitions(definitionsHash: string, data: AssetsDefinitionFile): void {
	GetAssetManager().load(definitionsHash, data);
	logger.info(`Loaded asset definitions, version: ${GetAssetManager().definitionsHash}`);
}
