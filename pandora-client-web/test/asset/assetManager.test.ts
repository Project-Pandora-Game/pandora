import { AssetsDefinitionFile } from 'pandora-common/dist/assets/definitions';
import { AssetManagerClient, GetCurrentAssetManager, LoadAssetDefinitions, UpdateAssetManager } from '../../src/assets/assetManager.tsx';

describe('GetCurrentAssetManager()', () => {
	it('should return instance of AssetManagerClient', () => {
		expect(GetCurrentAssetManager()).toBeInstanceOf(AssetManagerClient);
	});
});

describe('UpdateAssetManager()', () => {
	it('should override the current assetManager reference', () => {
		const newManager = new AssetManagerClient('v2');
		const oldManager = GetCurrentAssetManager();
		expect(GetCurrentAssetManager()).toBe(oldManager);
		UpdateAssetManager(newManager);
		expect(GetCurrentAssetManager()).toBe(newManager);
		expect(GetCurrentAssetManager()).not.toBe(oldManager);
	});
});

describe('LoadAssetDefinitions()', () => {
	it('should load asset definition', () => {
		const oldManager = GetCurrentAssetManager();
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		LoadAssetDefinitions('mock hash', {} as AssetsDefinitionFile, 'mock source');
		const newManager = GetCurrentAssetManager();
		expect(newManager).not.toBe(oldManager);
	});
});
