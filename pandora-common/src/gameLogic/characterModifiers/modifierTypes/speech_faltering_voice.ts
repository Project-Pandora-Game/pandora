import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { FalteringSpeech } from '../helpers/speechFunctions';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const speech_faltering_voice = DefineCharacterModifier({
	typeId: 'speech_faltering_voice',
	visibleName: 'Speech: Faltering voice',
	description: `
This modifier adds a stuttering voice effect to spoken messages, optionally with random filler sounds.
Spoken messages are affected automatically. Affects chat messages and whispers, but not OOC or emotes.
	`,
	strictnessCategory: 'normal',
	config: {
		addFillerSounds: {
			name: 'Randomly add filler sounds throughout the message',
			type: 'toggle',
			default: true,
		},
	},
	processChatMessageBeforeMuffle(config, content, _metadata) {
		return content.map((p) => [p[0], FalteringSpeech(p[1], config.addFillerSounds)]);
	},
});
