import { z } from 'zod';
import { Assert, KnownObject, ParseArrayNotEmpty, type Satisfies } from '../../../utility';
import type { CharacterModifierTypeDefinitionBase } from '../helpers/modifierDefinition';

import { block_lock_unlock_others } from './block_lock_unlock_others';
import { block_lock_unlock_self } from './block_lock_unlock_self';
import { effect_blind } from './effect_blind';
import { effect_block_hands } from './effect_block_hands';
import { effect_block_room_movement } from './effect_block_room_movement';
import { effect_block_space_leaving } from './effect_block_space_leaving';
import { effect_blur_vision } from './effect_blur_vision';
import { effect_hearing } from './effect_hearing';
import { effect_speech_garble } from './effect_speech_garble';
import { speech_doll_talk } from './speech_doll_talk';

//#region Character modifier types catalogue

/** Catalogue of all character modifier types */
export const CHARACTER_MODIFIER_TYPE_DEFINITION = {
	block_lock_unlock_others,
	block_lock_unlock_self,
	effect_blind,
	effect_block_hands,
	effect_block_room_movement,
	effect_block_space_leaving,
	effect_blur_vision,
	effect_hearing,
	effect_speech_garble,
	speech_doll_talk,
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
