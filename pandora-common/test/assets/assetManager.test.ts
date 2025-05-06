import { describe, expect, it } from '@jest/globals';
import { AssetManager } from '../../src/index.ts';
import { TEST_ASSETS_DEFINITION, TestAssetsLoadAssetManager } from './_testData/testAssetsDefinition.ts';

describe('AssetManager', () => {
	it('Loads without data', () => {
		const assetManager = new AssetManager('empty');

		expect(assetManager.definitionsHash).toBe('empty');
		expect(assetManager.getAllAssets()).toEqual([]);
	});

	it('Loads with test data', () => {
		const assetManager = TestAssetsLoadAssetManager();

		expect(assetManager.definitionsHash).toBe('test');
		expect(assetManager.graphicsId).toBe(TEST_ASSETS_DEFINITION.graphicsId);
		expect(assetManager.graphicsSourceId).toBe(TEST_ASSETS_DEFINITION.graphicsSourceId);
		expect(assetManager.rawData).toStrictEqual(TEST_ASSETS_DEFINITION);

		expect(Array.from(assetManager.backgroundTags.values())).toEqual(Object.values(TEST_ASSETS_DEFINITION.backgroundTags));
		expect(Array.from(assetManager.attributes.values())).toEqual(Object.values(TEST_ASSETS_DEFINITION.attributes));
		expect(assetManager.bodyparts).toEqual(TEST_ASSETS_DEFINITION.bodyparts);
		expect(assetManager.randomization).toEqual(TEST_ASSETS_DEFINITION.randomization);
		expect(assetManager.characterModifierTemplates).toEqual(TEST_ASSETS_DEFINITION.characterModifierTemplates);
		expect(assetManager.posePresets).toEqual(TEST_ASSETS_DEFINITION.posePresets);
	});
});
