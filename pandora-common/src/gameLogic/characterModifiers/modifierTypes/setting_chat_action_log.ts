import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const setting_chat_action_log = DefineCharacterModifier({
	typeId: 'setting_chat_action_log',
	visibleName: `Setting: Disable chat 'Action log'`,
	description: `
This modifier disables the ability to use the chat action log - preventing the character from seeing info about actions that don't produce an action message.

Hint: This can be combined with space settings to disable action messages to allow for "sneaky" actions during plays.
	`,
	strictnessCategory: 'strict',
	config: {},

	// Implemented externally on client only
});
