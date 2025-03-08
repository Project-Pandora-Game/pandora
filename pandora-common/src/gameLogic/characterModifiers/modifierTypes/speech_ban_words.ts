import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { CheckMessageForSounds } from '../helpers/speechFunctions';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_ban_words = DefineCharacterModifier({
	typeId: 'speech_ban_words',
	visibleName: 'Speech: Forbid saying specific words in the chat',
	description: `
This modifier forbids the character to use certain words in any chat message or whisper.

The list of required words can be configured.
Checks are not case sensitive. This means that adding 'no' also works for 'NO' and 'No'. If 'Also forbid variants of the words' is enabled, then 'NNoooo' would also be forbidden.
Doesn't affect emotes and OOC text.
	`,
	strictnessCategory: 'normal',
	config: {
		forbidVariants: {
			name: 'Also forbid variants of the words',
			type: 'toggle',
			default: false,
		},
		forbiddenWords: {
			name: 'List of words that cannot be used',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 100,
				maxEntryLength: 24,
				matchEntry: /^[\p{L}]*$/iug,
			},
		},
	},
	checkChatMessage(config, message) {
		if (message.type !== 'chat' || !config.forbiddenWords.length)
			return { result: 'ok' };

		const checkMsg = message.parts.map((p) => p[1].toLowerCase()).join('');
		const words = checkMsg.split(/[^\p{L}]+/iug).filter(Boolean);
		if (words.length === 0) {
			return { result: 'ok' };
		}

		let result: boolean;
		if (config.forbidVariants) {
			result = words.some((i) => CheckMessageForSounds(config.forbiddenWords, i, false));
		} else {
			const mandatoryWords = config.forbiddenWords.map((w) => w.toLowerCase());
			result = words.some((w) => mandatoryWords.includes(w));
		}

		if (result)
			return { result: 'block', reason: 'The message cannot contain forbidden words.' };
		return { result: 'ok' };
	},
});
