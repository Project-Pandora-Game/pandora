import { z } from 'zod';
import { KnownObject, ParseArrayNotEmpty } from '../../utility';
import { RecordUnpackSubobjectProperties, ZodArrayWithInvalidDrop } from '../../validation';
import { PermissionConfigSchema } from '../permissions';
import { CharacterModifierTypeGenericIdSchema } from './characterModifierBaseData';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, type CharacterModifierType } from './modifierTypes/_index';

/** Configuration for any character modifier _type_ (not an instance of a modifier) */
export const CharacterModifierTypeConfigSchema = z.object({
	permission: PermissionConfigSchema.nullable().catch(null),
});
/** Configuration for any character modifier _type_ (not an instance of a modifier) */
export type CharacterModifierTypeConfig = z.infer<typeof CharacterModifierTypeConfigSchema>;

/** Server-saved data of a character modifier instance */
export const CharacterModifierInstanceDataSchema = z.discriminatedUnion('type',
	ParseArrayNotEmpty(KnownObject.values(RecordUnpackSubobjectProperties('instanceDataSchema', CHARACTER_MODIFIER_TYPE_DEFINITION))),
);
/** Server-saved data of a character modifier instance (optionally filtered for a specific type) */
export type CharacterModifierInstanceData<TType extends CharacterModifierType = CharacterModifierType> =
	Extract<z.infer<typeof CharacterModifierInstanceDataSchema>, { readonly type: TType; }>;

/** Client data of a character modifier instance */
export const CharacterModifierInstanceClientDataSchema = z.discriminatedUnion('type',
	ParseArrayNotEmpty(KnownObject.values(RecordUnpackSubobjectProperties('clientDataSchema', CHARACTER_MODIFIER_TYPE_DEFINITION))),
);
/** Server-saved data of a character modifier instance (optionally filtered for a specific type) */
export type CharacterModifierInstanceClientData<TType extends CharacterModifierType = CharacterModifierType> =
	Extract<z.infer<typeof CharacterModifierInstanceClientDataSchema>, { readonly type: TType; }>;

/** Data of modifier instance effect - put onto a character if the modifier is active */
export const CharacterModifierEffectDataSchema = z.discriminatedUnion('type',
	ParseArrayNotEmpty(KnownObject.values(RecordUnpackSubobjectProperties('effectDataSchema', CHARACTER_MODIFIER_TYPE_DEFINITION))),
);
/** Data of modifier instance effect - put onto a character if the modifier is active (optionally filtered for a specific type) */
export type CharacterModifierEffectData<TType extends CharacterModifierType = CharacterModifierType> =
	Extract<z.infer<typeof CharacterModifierEffectDataSchema>, { readonly type: TType; }>;

/** Data of the whole character modifer subsystem, saved on character in database */
export const CharacterModifierSystemDataSchema = z.object({
	modifiers: ZodArrayWithInvalidDrop(CharacterModifierInstanceDataSchema, z.record(z.unknown())),
	typeConfig: z.record(CharacterModifierTypeGenericIdSchema, CharacterModifierTypeConfigSchema.optional()),
});
/** Data of the whole character modifer subsystem, saved on character in database */
export type CharacterModifierSystemData = z.infer<typeof CharacterModifierSystemDataSchema>;

/** Create default data for character modifier subsystem */
export function MakeDefaultCharacterModifierSystemData(): CharacterModifierSystemData {
	return {
		modifiers: [],
		typeConfig: {},
	};
}

/** Create an modifier effect from modifier instance */
export function CharacterModifierInstanceToEffect<TType extends CharacterModifierType>(instanceData: CharacterModifierInstanceData<TType>): CharacterModifierEffectData<TType> {
	// @ts-expect-error: Manually narrowed call.
	return CHARACTER_MODIFIER_TYPE_DEFINITION[instanceData.type].instanceToEffect(instanceData);
}
