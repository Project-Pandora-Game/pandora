import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { CheckMessageForSounds } from '../helpers/speechFunctions';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_require_defined_words = DefineCharacterModifier({
	typeId: 'speech_require_defined_words',
	visibleName: 'Speech: Require one of the defined words',
	description: `
This modifier gives the character a list of words from which at least one has to always be used in any chat message or whisper.

The list of required words can be configured.
Checks are not case sensitive. This means that adding 'miss' also works for 'MISS' and 'Miss'. If 'Allow word variants' is enabled, then 'Miiiiissss' would also match.
Doesn't affect emotes and OOC text.
	`,
	strictnessCategory: 'normal',
	config: {
		allowVariants: {
			name: 'Allow word variants',
			type: 'toggle',
			default: false,
		},
		mandatoryWords: {
			name: 'List of words where one always needs to be used',
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
		if (message.type !== 'chat' || !config.mandatoryWords.length)
			return { result: 'ok' };

		const checkMsg = message.parts.map((p) => p[1].toLowerCase()).join('');
		const words = checkMsg.split(/[^\p{L}]+/iug).filter(Boolean);
		if (words.length === 0) {
			return { result: 'ok' };
		}

		let result: boolean;
		if (config.allowVariants) {
			result = words.some((i) => CheckMessageForSounds(config.mandatoryWords, i, false));
		} else {
			const mandatoryWords = config.mandatoryWords.map((w) => w.toLowerCase());
			result = words.some((w) => mandatoryWords.includes(w));
		}

		if (!result)
			return { result: 'block', reason: 'The message must contain at least one of the defined words.' };
		return { result: 'ok' };
	},
});
