import type { BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Back hair long',
	bodypart: 'backhair',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/back_hair_long',
	allowRandomizerUsage: true,
	hasGraphics: false,
	colorization: {
		hair: {
			name: 'Hair',
			group: 'hair',
			default: '#444444',
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Hair',
			'Hair_back',
		],
	},
	modules: {
		colorGroupHair: {
			type: 'typed',
			name: 'Group Hair Color',
			variants: [
				{
					id: 'no',
					name: 'No',
					default: true,
				},
				{
					id: 'yes',
					name: 'Yes',
					properties: {
						overrideColorKey: ['hair'],
					},
				},
			],
		},
	},
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
