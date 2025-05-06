import { ItemInteractionType, type PersonalAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Top Hat',
	size: 'medium',
	type: 'personal',
	id: 'a/headwear/top_hat',
	allowRandomizerUsage: false,
	hasGraphics: false,
	colorization: {
		hat: {
			name: 'Hat',
			default: '#FFFFFF',
		},
		band: {
			name: 'Accent Band',
			default: '#653859',
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Clothing',
		],
	},
	modules: {
		hatType: {
			type: 'typed',
			name: 'Hat Type',
			interactionType: ItemInteractionType.ADD_REMOVE,
			variants: [
				{
					id: 'high',
					name: 'High',
				},
				{
					id: 'medium',
					name: 'Medium',
					default: true,
				},
				{
					id: 'low',
					name: 'Low',
				},
			],
		},
		hatColor: {
			type: 'typed',
			name: 'Hat Base Color',
			interactionType: ItemInteractionType.STYLING,
			variants: [
				{
					id: 'black',
					name: 'Black Top Hat',
					default: true,
				},
				{
					id: 'white',
					name: 'White Top Hat',
				},
			],
		},
		hair: {
			type: 'typed',
			name: 'Hide Hair',
			variants: [
				{
					id: 'no',
					name: 'No',
					default: true,
				},
				{
					id: 'yes',
					name: 'Hide hair',
					properties: {
						attributes: {
							hides: [
								'Hair',
							],
						},
					},
				},
			],
		},
	},
} satisfies PersonalAssetDefinition<AssetTestExtraArgs>;
