import type { AssetTestAttributeNames } from './testAttributes.ts';
import type { AssetTestBodypartName } from './testBodyparts.ts';
import type { AssetTestBones } from './testBones.ts';
import type { AssetTestColorGroupNames } from './testColorGroups.ts';

export interface AssetTestExtraArgs {
	bones: AssetTestBones;
	bodyparts: AssetTestBodypartName;
	attributes: AssetTestAttributeNames;
	colorGroups: AssetTestColorGroupNames;
}
