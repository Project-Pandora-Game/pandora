import { freeze, type Immutable } from 'immer';
import { Assert, AssetManager, type AssetsDefinitionFile } from '../../../src/index.ts';
import { TEST_ASSET_DEFINITIONS } from './assets/_index.ts';
import { AssetTestLoadBackgrounds, AssetTestLoadBackgroundTags } from './backgrounds/testBackgrounds.ts';
import { ASSET_TEST_ATTRIBUTES_DEFINITION } from './testAttributes.ts';
import { ASSET_TEST_BODYPARTS } from './testBodyparts.ts';
import { ASSET_TEST_BONE_DEFINITIONS } from './testBones.ts';
import { AssetTestLoadCharacterModifierTemplates } from './testCharacterModifierTemplates.ts';
import { ASSET_TEST_POSE_PRESETS } from './testPosePresets.ts';
import { ASSET_TEST_APPEARANCE_RANDOMIZATION_CONFIG } from './testRandomizationConfig.ts';

export const TEST_ASSETS_DEFINITION = freeze<Immutable<AssetsDefinitionFile>>({
	assets: TEST_ASSET_DEFINITIONS.reduce<AssetsDefinitionFile['assets']>((db, asset) => {
		Assert(!Object.hasOwn(db, asset.id));
		db[asset.id] = asset;
		return db;
	}, {}),
	bones: ASSET_TEST_BONE_DEFINITIONS,
	posePresets: ASSET_TEST_POSE_PRESETS,
	bodyparts: ASSET_TEST_BODYPARTS,
	backgroundTags: AssetTestLoadBackgroundTags(),
	backgrounds: AssetTestLoadBackgrounds(),
	tileTextures: [],
	graphicsId: 'graphicsId', // Not used in logic tests
	graphicsSourceId: 'graphicsSourceId', // Not used in logic tests
	attributes: ASSET_TEST_ATTRIBUTES_DEFINITION,
	randomization: ASSET_TEST_APPEARANCE_RANDOMIZATION_CONFIG,
	characterModifierTemplates: AssetTestLoadCharacterModifierTemplates(),
}, true);

export function TestAssetsLoadAssetManager(): AssetManager {
	return new AssetManager('test', TEST_ASSETS_DEFINITION);
}
