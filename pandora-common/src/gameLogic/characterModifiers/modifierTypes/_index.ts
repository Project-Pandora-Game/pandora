import { z } from 'zod';
import { Assert, KnownObject, ParseArrayNotEmpty, type Satisfies } from '../../../utility';
import type { CharacterModifierTypeDefinitionBase } from '../helpers/modifierDefinition';

import { effect_blind } from './effect_blind';
import { effect_block_hands } from './effect_block_hands';

//#region Character modifier types catalogue

/** Catalogue of all character modifier types */
export const CHARACTER_MODIFIER_TYPE_DEFINITION = {
	effect_blind,
	effect_block_hands,
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
	Extract<(typeof CHARACTER_MODIFIER_TYPE_DEFINITION)[CharacterModifierType], { readonly typeId: TType; }>;

// Check integrity
type __satisfies__ModiferTypeIds = Satisfies<typeof CHARACTER_MODIFIER_TYPE_DEFINITION, {
	[k in CharacterModifierType]: CharacterModifierTypeDefinitionBase & { typeId: k; };
}>;
Assert(KnownObject.entries(CHARACTER_MODIFIER_TYPE_DEFINITION).every(([k, v]) => k === v.typeId));
