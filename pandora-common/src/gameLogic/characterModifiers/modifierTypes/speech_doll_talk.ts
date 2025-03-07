import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_doll_talk = DefineCharacterModifier({
	typeId: 'speech_doll_talk',
	visibleName: 'Speech: Doll talk',
	description: `
This modifier forbids the character to use any words longer than the set limit and can additionally limit the number of words, too. Both limits are configurable independently. Doesn't affect emotes or OOC text, but does affect whispers.

_Note: Setting '0' means this part is not limited._
	`,
	strictnessCategory: 'normal',
	config: {
		maxWordLength: {
			name: 'Maximum character length of any word',
			type: 'number',
			default: 6,
			options: {
				min: 0,
			},
		},
		maxNumberOfWords: {
			name: 'Maximum number of words per message',
			type: 'number',
			default: 5,
			options: {
				min: 0,
			},
		},
	},
	checkChatMessage(config, message) {
		if (message.type !== 'chat')
			return { result: 'ok' };

		const fullText = message.parts.map((p) => p[1]).join('');
		const words = Array.from(fullText.matchAll(/[^\t\p{Z}\v.:!?~,;^]+/gmu)).map((i) => i[0]);
		if (config.maxNumberOfWords && words.length > config.maxNumberOfWords)
			return { result: 'block', reason: 'The message contains more words than allowed.' };
		if (config.maxWordLength && words.some((word) => word.length > config.maxWordLength))
			return { result: 'block', reason: 'The message contains words that are longer than allowed.' };
		return { result: 'ok' };
	},
});
