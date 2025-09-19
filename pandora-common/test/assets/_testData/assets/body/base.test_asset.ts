import { ItemInteractionType, type BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Base body',
	bodypart: 'base',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/base',
	allowRandomizerUsage: true,
	hasGraphics: false,
	colorization: {
		skin: {
			name: 'Skin',
			group: 'skin',
			default: '#ECC7BA',
		},
		nipples: {
			name: 'Nipples',
			default: '#FED1CB',
		},
	},
	preview: null,
	poseLimits: {
		bones: {
			breasts: [[-180, -180], [-70, -70], [0, 0], [100, 100], [180, 180]],
			tiptoeing: [[0, 180]],
		},
	},
	attributes: {
		provides: [
			'Body_base',
		],
	},
	modules: {
		muscleType: {
			type: 'typed',
			name: 'Stomach muscles',
			interactionType: ItemInteractionType.STYLING,
			variants: [
				{
					id: 'standard',
					name: 'Standard',
					default: true,
				},
				{
					id: 'muscular',
					name: 'Muscular',
				},
			],
		},
	},
	credits: { credits: ['Pandora'], sourcePath: '_destData/assets' },
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
