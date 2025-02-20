import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_blindfolds_blind_fully = DefineCharacterModifier({
	typeId: 'effect_blindfolds_blind_fully',
	visibleName: 'Effect: Fully blind when blindfolded',
	description: `
This modifier enforces full blindness when wearing any item that limits sight in any way.
It also strengthens character modifiers that apply a blind effect.
	`,
	strictnessCategory: 'normal',
	config: {},

	applyCharacterEffects(_config, currentEffects) {
		if (currentEffects.blind > 0) {
			return {
				blind: 10,
			};
		}
		return {};
	},
});
