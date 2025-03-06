import { nanoid } from 'nanoid';
import { HearingImpairment } from '../../../chat';
import { PseudoRandom } from '../../../math';
import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const hearing_selective_deprivation = DefineCharacterModifier({
	typeId: 'hearing_selective_deprivation',
	visibleName: 'Hearing: Selective hearing deprivation',
	description: `
TODO
This modifier impacts the character's natural ability to hear - in the same way items do.

The intensity of the effect can be adjusted and it stacks with worn items that have the same effect up to the maximum intensity defined in the configuration of this modifier.
The maximum intensity setting will not limit the sum of the deafening effects by items or other character modifiers.
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
		//TODO: change after stringList type is available
		wordWhitelist: {
			name: 'Words that can always be understood (separated by commas)',
			type: 'string',
			default: '',
			options: {
				maxLength: 256,
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

		const random = new PseudoRandom(nanoid());
		for (const part of content) {
			part[1] = part[1].replace(/\b(\w+)\b/ig, (match) => {
				if (random.prob(config.understandRandomWords / 100)) {
					// Passed random check
					return match;
				}

				return customImpairment.distortWord(match);
			});
		}

		return content;
	},
});
