import { Asset, AssetManager, AssetsDefinitionFile, GetLogger } from 'pandora-common';
import { Observable } from '../observable';

const logger = GetLogger('AssetManager');

export const assetManager = new class extends AssetManager {
	public readonly assetList = new Observable<Asset[]>([]);

	override load(definitionsHash: string, data: AssetsDefinitionFile): void {
		super.load(definitionsHash, data);
		this.assetList.value = this.getAllAssets();
	}
};

export function LoadAssetDefinitions(definitionsHash: string, data: AssetsDefinitionFile): void {
	assetManager.load(definitionsHash, data);
	logger.info(`Loaded asset definitions, version: ${assetManager.definitionsHash}`);
}
