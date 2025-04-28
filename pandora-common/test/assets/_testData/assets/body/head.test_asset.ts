import type { BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Head',
	bodypart: 'head',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/head',
	allowRandomizerUsage: true,
	hasGraphics: false,
	colorization: {
		skin: {
			name: 'Skin',
			group: 'skin',
			default: '#ECC7BA',
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Head_base',
		],
	},
	modules: {
		colorGroupHair: {
			type: 'typed',
			name: 'Same skin color as base body',
			variants: [
				{
					id: 'no',
					name: 'No',
				},
				{
					id: 'yes',
					name: 'Yes',
					properties: {
						overrideColorKey: ['skin'],
					},
					default: true,
				},
			],
		},
	},
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
