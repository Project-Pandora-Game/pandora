import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const setting_room_focus = DefineCharacterModifier({
	typeId: 'setting_room_focus',
	visibleName: `Setting: Force chat 'Focus mode'`,
	description: `
This modifier overrides the chat focus mode to the specified value - either preventing or forcing the character to see messages from other rooms in the same space.
	`,
	strictnessCategory: 'strict',
	config: {
		value: {
			name: 'Enable chat focus mode',
			type: 'toggle',
			default: true,
		},
	},

	// Implemented externally on client only
});
