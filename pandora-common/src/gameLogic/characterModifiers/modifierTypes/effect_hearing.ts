import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_hearing = DefineCharacterModifier({
	typeId: 'effect_hearing',
	visibleName: 'Effect: Sensory deprivation - Sound',
	description: `
This modifier impacts the character's natural ability to hear - in the same way items do.

The intensity of the effect can be adjusted and it stacks with worn items that have the same effect up to the maximum intensity defined in the configuration of this modifier.
The maximum intensity setting will not limit the sum of the deafening effects by items or other character modifiers.
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
		const maxExtraDistortion = Math.max(0, config.intensityMax - currentEffects.distortion);
		const maxExtraFrequencyLoss = Math.max(0, config.intensityMax - currentEffects.frequencyLoss);
		const maxExtraVowelLoss = Math.max(0, config.intensityMax - currentEffects.vowelLoss);
		const maxExtraMiddleLoss = Math.max(0, config.intensityMax - currentEffects.middleLoss);

		return {
			distortion: Math.min(config.intensity, maxExtraDistortion),
			frequencyLoss: Math.min(config.intensity, maxExtraFrequencyLoss),
			vowelLoss: Math.min(config.intensity, maxExtraVowelLoss),
			middleLoss: Math.min(config.intensity, maxExtraMiddleLoss),
		};
	},
});
