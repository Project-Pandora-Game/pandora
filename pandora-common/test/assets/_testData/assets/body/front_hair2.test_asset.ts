import type { BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Front hair 2',
	bodypart: 'fronthair',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/front_hair2',
	allowRandomizerUsage: true,
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
			'Hair_front',
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
	credits: { credits: ['Pandora'], sourcePath: '_destData/assets' },
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
