import type { AssetDefinition, AssetType } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export const TEST_ASSET_GROUP_BODY: AssetDefinition<AssetType, AssetTestExtraArgs>[] = (await Promise.all([
	import('./back_hair_long.test_asset.ts'),
	import('./back_hair_normal.test_asset.ts'),
	import('./back_hair_short.test_asset.ts'),
	import('./base.test_asset.ts'),
	import('./eyes.test_asset.ts'),
	import('./front_hair1.test_asset.ts'),
	import('./front_hair2.test_asset.ts'),
	import('./head.test_asset.ts'),
	import('./lips.test_asset.ts'),
])).map((m) => m.default);
