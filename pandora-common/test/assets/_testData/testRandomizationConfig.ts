import type { AppearanceRandomizationData } from '../../../src/index.ts';
import type { AssetTestExtraArgs } from './types.ts';

export const ASSET_TEST_APPEARANCE_RANDOMIZATION_CONFIG: AppearanceRandomizationData<AssetTestExtraArgs> = {
	// Make sure the order matches BODYPART_ORDER
	body: [
		'Body_base',
		'Head_base',
		'Eyes',
		'Mouth',
		'Hair_back',
		'Hair_front',
	],
	clothes: [
		'Underwear_panties',
		'Underwear_bra',
		'Footwear',
		'Clothing_upper',
		'Clothing_lower',
	],
	pose: {
		view: 'front',
		arms: {
			position: 'front',
			rotation: 'forward',
			fingers: 'spread',
		},
		legs: {
			pose: 'standing',
		},
		bones: {
			arm_r: 74,
			arm_l: 74,
			elbow_r: 15,
			elbow_l: 15,
		},
	},
};
