import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { FalteringSpeech } from '../helpers/speechFunctions';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_faltering_voice = DefineCharacterModifier({
	typeId: 'speech_faltering_voice',
	visibleName: 'Speech: Faltering voice',
	description: `
This modifier converts the character's messages, only able to speak in a stuttering voice and with random filler sounds, for some [RP] reason (anxiousness, arousal, fear, etc.). Converts the typed chat text automatically. Affects chat messages and whispers, but not OOC.
	`,
	strictnessCategory: 'normal',
	config: {
		addFillerSounds: {
			name: 'Additionally add randomized filler sounds throughout the message by chance',
			type: 'toggle',
			default: true,
		},
	},
	processChatMessageBeforeMuffle(config, content, _metadata) {
		return content.map((p) => [p[0], FalteringSpeech(p[1], config.addFillerSounds)]);
	},
});
