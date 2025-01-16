import { z } from 'zod';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { PermissionConfigSchema } from '../permissions';
import { CharacterModifierConfigurationSchema, CharacterModifierTypeGenericIdSchema } from './characterModifierBaseData';
import { CharacterModifierTypeSchema } from './modifierTypes/_index';

/** Configuration for any character modifier _type_ (not an instance of a modifier) */
export const CharacterModifierTypeConfigSchema = z.object({
	permission: PermissionConfigSchema.nullable().catch(null),
});
/** Configuration for any character modifier _type_ (not an instance of a modifier) */
export type CharacterModifierTypeConfig = z.infer<typeof CharacterModifierTypeConfigSchema>;

/** Server-saved data of a character modifier instance */
export const CharacterModifierInstanceDataSchema = z.object({
	/** Unique identifier */
	id: z.string(),
	type: CharacterModifierTypeSchema,
	enabled: z.boolean(),
	config: CharacterModifierConfigurationSchema,
});

/** Server-saved data of a character modifier instance */
export type CharacterModifierInstanceData = z.infer<typeof CharacterModifierInstanceDataSchema>;

/** Client data of a character modifier instance */
export const CharacterModifierInstanceClientDataSchema = z.object({
	/** Unique identifier */
	id: z.string(),
	type: CharacterModifierTypeSchema,
	enabled: z.boolean(),
	config: CharacterModifierConfigurationSchema,
});
/** Server-saved data of a character modifier instance */
export type CharacterModifierInstanceClientData = z.infer<typeof CharacterModifierInstanceClientDataSchema>;

/** Data of modifier instance effect - put onto a character if the modifier is active */
export const CharacterModifierEffectDataSchema = z.object({
	id: z.string(),
	type: CharacterModifierTypeSchema,
	config: CharacterModifierConfigurationSchema,
});
/** Data of modifier instance effect - put onto a character if the modifier is active */
export type CharacterModifierEffectData = z.infer<typeof CharacterModifierEffectDataSchema>;

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
