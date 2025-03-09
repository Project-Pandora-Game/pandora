import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_forbid_talking_openly = DefineCharacterModifier({
	typeId: 'speech_forbid_talking_openly',
	visibleName: 'Speech: Forbid talking openly',
	description: `
This modifier forbids the character to send a chat message to all people. Doesn't affect whispers, emotes, and OOC text.
	`,
	strictnessCategory: 'normal',
	config: {},
	checkChatMessage(_config, message) {
		if (message.type !== 'chat' || message.to != null)
			return { result: 'ok' };

		return { result: 'block', reason: 'Talking openly is not allowed.' };
	},
});
