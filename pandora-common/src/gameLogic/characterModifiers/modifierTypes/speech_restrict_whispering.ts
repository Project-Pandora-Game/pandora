import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_restrict_whispering = DefineCharacterModifier({
	typeId: 'speech_restrict_whispering',
	visibleName: 'Speech: Forbid whispering',
	description: `
This modifier forbids the character to send normal whisper messages.
OOC whispers are not affected by this modifier.
You can also specify characters who can still be whispered to.
	`,
	strictnessCategory: 'normal',
	config: {
		characterWhitelist: {
			name: 'List of characters who can still be whispered to',
			type: 'characterList',
			default: [],
		},
	},
	checkChatMessage(config, message) {
		if (message.type !== 'chat' || message.to == null)
			return { result: 'ok' };

		if (config.characterWhitelist.includes(message.to))
			return { result: 'ok' };

		return { result: 'block', reason: 'Whispering normally to this character is not allowed.' };
	},
});
