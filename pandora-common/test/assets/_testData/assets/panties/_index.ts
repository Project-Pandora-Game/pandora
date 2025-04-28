import type { AssetDefinition, AssetType } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export const TEST_ASSET_GROUP_PANTIES: AssetDefinition<AssetType, AssetTestExtraArgs>[] = (await Promise.all([
	import('./style1.test_asset.ts'),
])).map((m) => m.default);
