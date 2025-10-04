import { type PersonalAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Plain Panties',
	size: 'small',
	type: 'personal',
	id: 'a/panties/style1',
	allowRandomizerUsage: true,
	colorization: {
		panties: {
			name: 'Panties',
			default: '#FA5F55',
		},
		wetness: {
			name: 'Stain',
			default: '#B14848',
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Clothing',
			'Underwear',
			'Underwear_panties',
		],
	},
	modules: {
		pantiesState: {
			type: 'typed',
			name: 'Panties State',
			variants: [
				{
					id: 'normal',
					name: 'Normal',
					default: true,
				},
				{
					id: 'aside',
					name: 'Pulled Aside',
				},
				{
					id: 'wedged',
					name: 'Wedged Up',
				},
				{
					id: 'knees',
					name: 'Pulled Around Knees',
					properties: {
						poseLimits: {
							bones: {
								leg_r: [[-3, 2]],
								leg_l: [[-3, 2]],
							},
						},
					},
				},
				{
					id: 'fully',
					name: 'Pulled Down Fully',
					properties: {
						poseLimits: {
							bones: {
								leg_r: [[-3, 2]],
								leg_l: [[-3, 2]],
							},
						},
					},
				},
			],
		},
		wet: {
			type: 'typed',
			name: 'Visible Wet Spot',
			variants: [
				{
					id: 'no',
					name: 'Dry',
					default: true,
				},
				{
					id: 'wet',
					name: 'Telltale Wetness',
				},
			],
		},
	},
	credits: { credits: ['Pandora'], sourcePath: '_destData/assets' },
} satisfies PersonalAssetDefinition<AssetTestExtraArgs>;
