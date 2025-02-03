import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_blind = DefineCharacterModifier({
	typeId: 'effect_blind',
	visibleName: 'Effect: Blindness',
	strictnessCategory: 'normal',
	config: {
		intensity: {
			name: 'Intensity',
			type: 'number',
			default: 1,
			options: {
				min: 0,
				max: 10,
				withSlider: true,
			},
		},
		intensityMax: {
			name: 'Maximum intensity',
			type: 'number',
			default: 10,
			options: {
				min: 0,
				max: 10,
				withSlider: true,
			},
		},
	},

	applyCharacterEffects(config, currentEffects) {
		const maxExtraBlind = Math.max(0, config.intensityMax - currentEffects.blind);

		return {
			blind: Math.min(config.intensity, maxExtraBlind),
		};
	},
});
