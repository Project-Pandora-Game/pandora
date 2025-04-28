import type { AssetDefinition, AssetType } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export const TEST_ASSET_GROUP_HEADGEAR: AssetDefinition<AssetType, AssetTestExtraArgs>[] = (await Promise.all([
	import('./top_hat.test_asset.ts'),
])).map((m) => m.default);
