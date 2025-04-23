import type { AssetDefinition, AssetType } from '../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../types.ts';
import { TEST_ASSET_GROUP_BODY } from './body/_index.ts';

export const TEST_ASSET_DEFINITIONS: AssetDefinition<AssetType, AssetTestExtraArgs>[] = [
	...TEST_ASSET_GROUP_BODY,
];
