import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';
import { CheckMessageForSounds } from '../helpers/speechFunctions.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_specific_sounds_only = DefineCharacterModifier({
	typeId: 'speech_specific_sounds_only',
	visibleName: 'Speech: Allow specific sounds only',
	description: `
This modifier only allows the character to communicate when using a sound from a list of specific sound patterns.

The set sound patterns cannot be mixed in the same chat message, though. Only one sound from the list per message is valid. That said, any variation of a sound in the list is allowed as long as the letters are in order. Doesn't affect emotes and OOC text, but does affect whispers.

_Example_: If the set sound is 'Meow', then this is a valid message: 'Me..ow? meeeow! mmeooowwwwwww?! meow. me.. oo..w ~'
	`,
	strictnessCategory: 'normal',
	config: {
		soundWhitelist: {
			name: 'List of allowed sounds',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 50,
				maxEntryLength: 24,
				matchEntry: /^\p{L}*$/igu,
			},
		},
	},
	checkChatMessage(config, message) {
		const sounds = config.soundWhitelist;

		if (sounds && sounds.length > 0 && message.type === 'chat') {
			const fullText = message.parts.map((p) => p[1].toLowerCase()).join('');
			if (!CheckMessageForSounds(sounds, fullText))
				return { result: 'block', reason: 'The message can only contain one of the configured allowed sounds.' };
		}
		return { result: 'ok' };
	},
});
