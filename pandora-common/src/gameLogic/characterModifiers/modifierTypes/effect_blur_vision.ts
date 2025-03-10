import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_blur_vision = DefineCharacterModifier({
	typeId: 'effect_blur_vision',
	visibleName: 'Effect: Blur vision',
	description: `
This modifier impacts the character's natural ability to see - blurring the vision.

The intensity of the effect can be adjusted and it stacks with worn items that have the same effect up to the maximum intensity defined in the configuration of this modifier.
The maximum intensity setting will not limit the sum of the effects by items or other character modifiers.

__Warning:__ This effect can negatively impact performance on some devices.
	`,
	strictnessCategory: 'normal',
	config: {
		intensity: {
			name: 'Intensity',
			type: 'number',
			default: 1,
			options: {
				min: 0,
				max: 16,
				withSlider: true,
			},
		},
		intensityMax: {
			name: 'Maximum intensity',
			type: 'number',
			default: 16,
			options: {
				min: 0,
				max: 16,
				withSlider: true,
			},
		},
	},

	applyCharacterEffects(config, currentEffects) {
		const maxExtraBlur = Math.max(0, config.intensityMax - currentEffects.blurVision);

		return {
			blurVision: Math.min(config.intensity, maxExtraBlur),
		};
	},
});
