import { AssetsDefinitionFile } from 'pandora-common/dist/assets/definitions';
import { AssetManagerClient, GetAssetManager, LoadAssetDefinitions, OverrideAssetManager } from '../../src/assets/assetManager';

describe('GetAssetManager()', () => {
	it('should return instance of AssetManagerClient', () => {
		expect(GetAssetManager()).toBeInstanceOf(AssetManagerClient);
	});
});

describe('OverrideAssetManager()', () => {
	it('should override the current assetManager reference', () => {
		const newManager = new AssetManagerClient();
		const oldManager = GetAssetManager();
		expect(GetAssetManager()).toBe(oldManager);
		OverrideAssetManager(newManager);
		expect(GetAssetManager()).toBe(newManager);
		expect(GetAssetManager()).not.toBe(oldManager);
	});
});

describe('LoadAssetDefinitions()', () => {
	it('should load asset definition into manager', () => {
		const mock = jest.spyOn(GetAssetManager(), 'load').mockImplementation();
		LoadAssetDefinitions('mock hash', 'mock data' as unknown as AssetsDefinitionFile, 'mock source');
		expect(mock).nthCalledWith(1, 'mock hash', 'mock data');
		mock.mockRestore();
	});
});
