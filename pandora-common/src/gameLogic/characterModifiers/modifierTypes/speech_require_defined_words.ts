import { escapeRegExp } from 'lodash';
import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { CheckMessageForSounds } from '../helpers/speechFunctions';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_require_defined_words = DefineCharacterModifier({
	typeId: 'speech_require_defined_words',
	visibleName: 'Speech: Require one of the defined words',
	description: `
This modifier gives the character a list of words from which at least one has to always be used in any chat message or whisper.

The list of required words can be configured. Checks are not case sensitive (adding 'miss' also works for 'MISS' and 'Miss' - Note: 'Miiiiissss' would also match). Doesn't affect emotes and OOC text.'
	`,
	strictnessCategory: 'normal',
	config: {
		mandatoryWords: {
			name: 'List of words where one always needs to be used',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 100,
				maxEntryLength: 24,
				matchEntry: /^[\p{L} ]*$/iu,
			},
		},
	},
	checkChatMessage(config, message) {
		if (message.type !== 'chat' || !config.mandatoryWords?.length)
			return { result: 'ok' };

		const checkMsg = message.parts.map((p) => p[1].toLocaleLowerCase()).join('');
		const sounds = config.mandatoryWords.filter((e) => /^[\p{L}]*$/iu.test(e));
		if (checkMsg.trim() === '') {
			return { result: 'ok' };
		}

		const result = config.mandatoryWords.some((i) =>
			new RegExp(`([^\\p{L}]|^)${escapeRegExp(i.trim())}([^\\p{L}]|$)`, 'iu').exec(checkMsg),
		) || checkMsg.split(/[^\p{L}]+/u).some((i) => CheckMessageForSounds(sounds, i, false));

		if (!result)
			return { result: 'block', reason: 'The message must contain at least one of the defined words.' };
		return { result: 'ok' };
	},
});
