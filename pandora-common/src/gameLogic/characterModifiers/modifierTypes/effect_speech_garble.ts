import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_speech_garble = DefineCharacterModifier({
	typeId: 'effect_speech_garble',
	visibleName: 'Effect: Force garbled speech',
	description: `
This modifier forces the character's to talk as if gagged by items, automatically garbling speaking.

It affects whispers, but does not affect OOC. The intensity of the effect can be adjusted and it stacks with worn items that have the same effect up to the maximum intensity defined in the configuration of this modifier.
The maximum intensity setting will not limit the sum of the garbling effects by items or other character modifiers.
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
		const maxExtraLipsTouch = Math.max(0, config.intensityMax - currentEffects.lipsTouch);
		const maxExtraJawMove = Math.max(0, config.intensityMax - currentEffects.jawMove);
		const maxExtraTongueRoof = Math.max(0, config.intensityMax - currentEffects.tongueRoof);
		const maxExtraMouthBreath = Math.max(0, config.intensityMax - currentEffects.mouthBreath);
		const maxExtraThroatBreath = Math.max(0, config.intensityMax - currentEffects.throatBreath);
		const maxExtraCoherency = Math.max(0, config.intensityMax - currentEffects.coherency);
		const maxExtraStimulus = Math.max(0, config.intensityMax - currentEffects.stimulus);

		return {
			lipsTouch: Math.min(config.intensity, maxExtraLipsTouch),
			jawMove: Math.min(config.intensity, maxExtraJawMove),
			tongueRoof: Math.min(config.intensity, maxExtraTongueRoof),
			mouthBreath: Math.min(Math.round(config.intensity / 1.5), maxExtraMouthBreath),
			throatBreath: Math.min(Math.round(config.intensity / 1.5), maxExtraThroatBreath),
			coherency: Math.min(Math.round(config.intensity / 2), maxExtraCoherency),
			stimulus: Math.min(Math.round(config.intensity / 2), maxExtraStimulus),
		};
	},
});
