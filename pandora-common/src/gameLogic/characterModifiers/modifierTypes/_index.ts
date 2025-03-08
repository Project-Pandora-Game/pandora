import { z } from 'zod';
import { Assert, KnownObject, ParseArrayNotEmpty, type Satisfies } from '../../../utility';
import type { CharacterModifierTemplate } from '../characterModifierData';
import type { CharacterModifierConditionChain } from '../conditions';
import type { CharacterModifierTypeDefinitionBase } from '../helpers/modifierDefinition';

import { block_adding_new_modifiers } from './block_adding_new_modifiers';
import { block_creating_items } from './block_creating_items';
import { block_deleting_items } from './block_deleting_items';
import { block_equipping_items_others } from './block_equipping_items_others';
import { block_equipping_items_self } from './block_equipping_items_self';
import { block_lock_unlock_others } from './block_lock_unlock_others';
import { block_lock_unlock_self } from './block_lock_unlock_self';
import { block_removing_items_others } from './block_removing_items_others';
import { block_removing_items_self } from './block_removing_items_self';
import { effect_blind } from './effect_blind';
import { effect_block_hands } from './effect_block_hands';
import { effect_block_room_movement } from './effect_block_room_movement';
import { effect_block_space_leaving } from './effect_block_space_leaving';
import { effect_blur_vision } from './effect_blur_vision';
import { effect_delayed_bound_usage } from './effect_delayed_bound_usage';
import { effect_hearing } from './effect_hearing';
import { effect_slow_wardrobe_actions } from './effect_slow_wardrobe_actions';
import { effect_speech_garble } from './effect_speech_garble';
import { hearing_selective_deprivation } from './hearing_selective_deprivation';
import { speech_ban_words } from './speech_ban_words';
import { speech_doll_talk } from './speech_doll_talk';
import { speech_faltering_voice } from './speech_faltering_voice';
import { speech_forbid_talking_openly } from './speech_forbid_talking_openly';
import { speech_require_defined_words } from './speech_require_defined_words';
import { speech_restrict_whispering } from './speech_restrict_whispering';
import { speech_specific_sounds_only } from './speech_specific_sounds_only';

//#region Character modifier types catalogue

/** Catalogue of all character modifier types */
export const CHARACTER_MODIFIER_TYPE_DEFINITION = {
	block_adding_new_modifiers,
	block_creating_items,
	block_deleting_items,
	block_equipping_items_others,
	block_equipping_items_self,
	block_lock_unlock_others,
	block_lock_unlock_self,
	block_removing_items_others,
	block_removing_items_self,
	effect_blind,
	effect_block_hands,
	effect_block_room_movement,
	effect_block_space_leaving,
	effect_blur_vision,
	effect_delayed_bound_usage,
	effect_hearing,
	effect_slow_wardrobe_actions,
	effect_speech_garble,
	hearing_selective_deprivation,
	speech_ban_words,
	speech_doll_talk,
	speech_faltering_voice,
	speech_forbid_talking_openly,
	speech_require_defined_words,
	speech_restrict_whispering,
	speech_specific_sounds_only,
} as const satisfies Readonly<Record<string, CharacterModifierTypeDefinitionBase>>;

//#endregion

/** List of all character modifier types */
export const CHARACTER_MODIFIER_TYPES = ParseArrayNotEmpty(
	KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION),
);

/** Identifier of a character modifier type */
export const CharacterModifierTypeSchema = z.enum(CHARACTER_MODIFIER_TYPES);
/** Identifier of a character modifier type */
export type CharacterModifierType = (keyof typeof CHARACTER_MODIFIER_TYPE_DEFINITION) & string;

/** Definition of a character modifier type, optionally filterable to a specific type */
export type CharacterModifierTypeDefinition<TType extends CharacterModifierType = CharacterModifierType> =
	(typeof CHARACTER_MODIFIER_TYPE_DEFINITION)[TType];

// Check integrity
type __satisfies__ModiferTypeIds = Satisfies<typeof CHARACTER_MODIFIER_TYPE_DEFINITION, {
	[k in CharacterModifierType]: CharacterModifierTypeDefinitionBase & { typeId: k; };
}>;
Assert(KnownObject.entries(CHARACTER_MODIFIER_TYPE_DEFINITION).every(([k, v]) => k === v.typeId));

/** Configuration for specific modifier type */
export type CharacterModifierSpecificConfig<TType extends CharacterModifierType> = z.infer<CharacterModifierTypeDefinition<TType>['configSchema']>;

/** Character modifier template, built to fully match a specific modifier */
export type CharacterModifierSpecificTemplate = Satisfies<{
	[Type in CharacterModifierType]: {
		type: Type;
		name: string;
		config: CharacterModifierSpecificConfig<Type>;
		conditions: CharacterModifierConditionChain;
	};
}[CharacterModifierType], CharacterModifierTemplate>;
