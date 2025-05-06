import { isEqual } from 'lodash-es';
import {
	Assert,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierNameSchema,
	KnownObject,
	type CharacterModifierInbuiltTemplates,
	type CharacterModifierParametrizedConditionChain,
	type CharacterModifierSpecificTemplate,
	type CharacterModifierType,
	type Satisfies,
} from '../../../src/index.ts';
import type { AssetTestExtraArgs } from './types.ts';

//#region Character modifier template definitions

const ASSET_TEST_CHARACTER_MODIFIER_TEMPLATES: AssetTestSpecificCharacterModifierInbuiltTemplates = {
	effect_blind: [
		{
			type: 'effect_blind',
			name: 'Fully blind while wearing any blindfolding items',
			config: {
				intensity: 10,
				intensityMax: 10,
			},
			conditions: [
				{
					logic: 'or',
					invert: false,
					condition: {
						type: 'hasItemWithEffect',
						effect: 'blind',
						minStrength: 1,
					},
				},
			],
		},
	],
	speech_faltering_voice: [
		{
			type: 'speech_faltering_voice',
			name: 'Stuttering while fully naked',
			config: {
				addFillerSounds: false,
			},
			conditions: [
				{
					logic: 'or',
					invert: true,
					condition: {
						type: 'hasItemWithAttribute',
						attribute: 'Clothing_upper',
					},
				},
				{
					logic: 'and',
					invert: true,
					condition: {
						type: 'hasItemWithAttribute',
						attribute: 'Clothing_lower',
					},
				},
				{
					logic: 'and',
					invert: true,
					condition: {
						type: 'hasItemWithAttribute',
						attribute: 'Underwear',
					},
				},
			],
		},
	],
};

//#endregion Character modifier template definitions

export type AssetTestSpecificCharacterModifierInbuiltTemplates = Satisfies<{
	[Type in CharacterModifierType]?: (Extract<CharacterModifierSpecificTemplate, { type: Type; }> & {
		conditions: CharacterModifierParametrizedConditionChain<AssetTestExtraArgs>;
	})[];
}, CharacterModifierInbuiltTemplates>;

export function AssetTestLoadCharacterModifierTemplates(): CharacterModifierInbuiltTemplates {
	for (const [k, v] of KnownObject.entries(ASSET_TEST_CHARACTER_MODIFIER_TEMPLATES)) {
		if (v == null)
			continue;

		const names = v.map((t) => t.name);
		Assert(new Set(names).size === names.length);

		const modifierDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[k];
		for (const template of v) {
			Assert(CharacterModifierNameSchema.parse(template.name) === template.name);

			// Parse should always work here
			const parsedConfig = modifierDefinition.configSchema.parse(template.config);
			Assert(isEqual(template.config, parsedConfig));

			Assert(template.conditions.length === 0 || template.conditions[0].logic === 'or');
		}
	}

	return ASSET_TEST_CHARACTER_MODIFIER_TEMPLATES;
}
