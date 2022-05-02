import { AssetManager, AssetsDefinitionFile, GetLogger } from 'pandora-common';

const logger = GetLogger('AssetManager');

export const assetManager = new AssetManager();

export function LoadAssetDefinitions(definitionsHash: string, data: AssetsDefinitionFile): void {
	assetManager.load(definitionsHash, data);
	logger.info(`Loaded asset definitions, version: ${assetManager.definitionsHash}`);
}
