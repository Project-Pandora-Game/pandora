import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_adding_new_modifiers = DefineCharacterModifier({
	typeId: 'block_adding_new_modifiers',
	visibleName: 'Block: Forbid adding new character modifiers',
	description: `
This modifier prevents this character from adding new character modifiers on themselves.
	`,
	strictnessCategory: 'strict',
	config: {},

	// Implemented externally in `CharacterModifierActionCheckAdd`
});
