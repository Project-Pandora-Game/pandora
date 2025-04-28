import type { BodypartAssetDefinition } from '../../../../../src/index.ts';
import type { AssetTestExtraArgs } from '../../types.ts';

export default {
	name: 'Eyes',
	bodypart: 'eyes',
	type: 'bodypart',
	size: 'bodypart',
	id: 'a/body/eyes',
	allowRandomizerUsage: true,
	hasGraphics: false,
	colorization: {
		eyeColor: {
			name: 'Eye color',
			default: '#2D589B',
		},
		lashes: {
			name: 'Lashes',
			default: '#555555',
		},
		shine: {
			name: 'Shine',
			default: '#A8CEE4CC',
			minAlpha: 0,
		},
	},
	preview: null,
	attributes: {
		provides: [
			'Eyes',
		],
	},
	modules: {
		eyeState_l: {
			type: 'typed',
			name: 'Left Eye Open/Close',
			expression: 'Left Eye Open/Close',
			variants: [
				{
					id: 'normal',
					name: 'Open',
					default: true,
				},
				{
					id: 'closed',
					name: 'Closed',
				},
				{
					id: 'blind',
					name: 'Closed with blind effect',
					properties: {
						effects: {
							blind: 4.99,
						},
					},
				},
			],
		},
		eyeState_r: {
			type: 'typed',
			name: 'Right Eye Open/Close',
			expression: 'Right Eye Open/Close',
			variants: [
				{
					id: 'normal',
					name: 'Open',
					default: true,
				},
				{
					id: 'closed',
					name: 'Closed',
				},
				{
					id: 'blind',
					name: 'Closed with blind effect',
					properties: {
						effects: {
							blind: 4.99,
						},
					},
				},
			],
		},
		eyeDirection: {
			type: 'typed',
			name: 'Eye Variants',
			expression: 'Eye Variants',
			variants: [
				{
					id: 'straight',
					name: 'Straight',
					default: true,
				},
				{
					id: 'right',
					name: 'Right',
				},
				{
					id: 'left',
					name: 'Left',
				},
				{
					id: 'down',
					name: 'Down',
				},
				{
					id: 'up',
					name: 'Up',
				},
			],
		},
	},
} satisfies BodypartAssetDefinition<AssetTestExtraArgs>;
