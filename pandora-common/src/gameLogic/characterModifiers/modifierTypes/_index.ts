import { Assert, KnownObject, ParseArrayNotEmpty, type Satisfies } from '../../../utility';
import type { CharacterModifierConfigBase } from '../helpers/modifierDefinition';

import { effect_blind } from './effect_blind';
import { effect_block_hands } from './effect_block_hands';

//#region Character modifier types catalogue

export const CHARACTER_MODIFIER_TYPE_CONFIG = {
	effect_blind,
	effect_block_hands,
} as const satisfies Readonly<Record<string, CharacterModifierConfigBase>>;

//#endregion

export type CharacterModifierType = (keyof typeof CHARACTER_MODIFIER_TYPE_CONFIG) & string;

export const CHARACTER_MODIFIER_TYPES = ParseArrayNotEmpty(
	KnownObject.keys(CHARACTER_MODIFIER_TYPE_CONFIG),
);

// Check integrity
type __satisfies__ModiferTypeIds = Satisfies<typeof CHARACTER_MODIFIER_TYPE_CONFIG, {
	[k in CharacterModifierType]: CharacterModifierConfigBase & { typeId: k; };
}>;
Assert(KnownObject.entries(CHARACTER_MODIFIER_TYPE_CONFIG).every(([k, v]) => k === v.typeId));
