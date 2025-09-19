import type { BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Lips',
	bodypart: 'lips',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/lips',
	allowRandomizerUsage: true,
	hasGraphics: false,
	colorization: {
		lips: {
			name: 'Lips',
			default: '#FCB6B4',
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Mouth',
		],
	},
	modules: {
		mouth: {
			type: 'typed',
			name: 'Mouth expressions',
			expression: 'Mouth',
			variants: [
				{
					id: 'neutral',
					name: 'Neutral',
					default: true,
				},
				{
					id: 'smile',
					name: 'Faint Smile',
				},
				{
					id: 'laugh',
					name: 'Open',
					properties: {
						attributes: {
							provides: [
								'Mouth_open_wide',
							],
						},
					},
				},
				{
					id: 'open',
					name: 'Open Wide',
					properties: {
						attributes: {
							provides: ['Mouth_open_wide'],
						},
					},
				},
				{
					id: 'tongue',
					name: 'Tongue Out',
					properties: {
						attributes: {
							provides: [
								'Mouth_tongue_out',
								'Mouth_open_wide',
							],
						},
					},
				},
			],
		},
	},
	credits: { credits: ['Pandora'], sourcePath: '_destData/assets' },
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
