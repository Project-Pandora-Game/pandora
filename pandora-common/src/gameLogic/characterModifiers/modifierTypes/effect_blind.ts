import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_blind = DefineCharacterModifier({
	typeId: 'effect_blind',
	visibleName: 'Effect: Sensory deprivation - Sight',
	description: `
This modifier impacts the character's natural ability to see - in the same way blindfolding items do.

The intensity of the effect can be adjusted and it stacks with worn items that have the same effect up to the maximum intensity defined in the configuration of this modifier.
If the sum of the blind effects of all worn items together is not lower than the set maximum intensity, the defined intensity of this modifier does nothing.
	`,
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
