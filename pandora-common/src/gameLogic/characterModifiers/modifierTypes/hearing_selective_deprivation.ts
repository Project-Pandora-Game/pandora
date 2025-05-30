import { nanoid } from 'nanoid';
import { HearingImpairment } from '../../../chat/index.ts';
import { PseudoRandom } from '../../../math/index.ts';
import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const hearing_selective_deprivation = DefineCharacterModifier({
	typeId: 'hearing_selective_deprivation',
	visibleName: 'Hearing: Selective hearing deprivation',
	description: `
This modifier impacts the character's ability to hear, but allows for partial hearing.

__This modifier is applied on top of items and other modifiers.__
Characters/words listed in the allow lists will still be impacted by other sources. OOC text is not affected by this modifier.

This modifier works in the same way as standard hearing deprivation does, based on the "Intensity" setting.
You can, however, exclude characters or specific words from its effect or specify a random chance for a word not to be affected at all.
`,
	strictnessCategory: 'normal',
	config: {
		intensity: {
			name: 'Intensity',
			type: 'number',
			default: 9,
			options: {
				min: 0,
				max: 10,
				withSlider: true,
			},
		},
		characterWhitelist: {
			name: 'List of characters who can always be understood',
			type: 'characterList',
			default: [],
		},
		wordAllowlist: {
			name: 'Words that can always be understood',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 100,
				maxEntryLength: 24,
				matchEntry: /^\p{L}+$/igu,
			},
		},
		understandRandomWords: {
			name: 'Some words can be randomly understood with the set percentage',
			type: 'number',
			default: 0,
			options: {
				min: 0,
				max: 100,
				withSlider: true,
			},
		},
		wordLength: {
			name: 'Distort words that are longer than a given value',
			type: 'number',
			default: 8,
			options: {
				min: 0,
			},
		},
		longWordDistortion: {
			name: 'Intensity of long word scrambling',
			type: 'number',
			default: 9,
			options: {
				min: 0,
				max: 10,
				withSlider: true,
			},
		},
	},

	processReceivedChatMessageBeforeFilters(config, content, metadata) {
		if (config.characterWhitelist.includes(metadata.from))
			return content;

		const customImpairment = new HearingImpairment(metadata.from, {
			distortion: config.intensity,
			frequencyLoss: config.intensity,
			middleLoss: config.intensity,
			vowelLoss: config.intensity,
		});

		const longWordImpairment = new HearingImpairment(metadata.from, {
			distortion: config.longWordDistortion,
			frequencyLoss: config.longWordDistortion,
			middleLoss: config.longWordDistortion,
			vowelLoss: config.longWordDistortion,
		});

		const wordAllowlist = config.wordAllowlist.map((w) => w.trim().toLowerCase()).filter(Boolean);

		const random = new PseudoRandom(nanoid());
		for (const part of content) {
			part[1] = part[1].replace(/\b(\p{L}+)\b/igu, (match) => {
				if (random.prob(config.understandRandomWords / 100)) {
					// Passed random check
					return match;
				}

				// Check allowlisted words
				if (wordAllowlist.includes(match.toLowerCase())) {
					return match;
				}

				return match.length >= config.wordLength ?
					longWordImpairment.distortWord(match) : customImpairment.distortWord(match);
			});
		}

		return content;
	},
});
