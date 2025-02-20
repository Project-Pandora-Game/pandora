import { cloneDeep } from 'lodash';
import { z } from 'zod';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { PermissionConfigSchema } from '../permissions';
import { CharacterModifierConfigurationSchema, CharacterModifierIdSchema, CharacterModifierNameSchema, CharacterModifierTypeGenericIdSchema } from './characterModifierBaseData';
import { CharacterModifierConditionChainSchema } from './conditions/characterModifierConditionChain';
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
	id: CharacterModifierIdSchema,
	type: CharacterModifierTypeSchema,
	name: CharacterModifierNameSchema.catch(''),
	enabled: z.boolean(),
	config: CharacterModifierConfigurationSchema,
	conditions: CharacterModifierConditionChainSchema.catch(() => []),
});

/** Server-saved data of a character modifier instance */
export type CharacterModifierInstanceData = z.infer<typeof CharacterModifierInstanceDataSchema>;

/** Client data of a character modifier instance */
export const CharacterModifierInstanceClientDataSchema = z.object({
	/** Unique identifier */
	id: CharacterModifierIdSchema,
	type: CharacterModifierTypeSchema,
	name: CharacterModifierNameSchema,
	enabled: z.boolean(),
	config: CharacterModifierConfigurationSchema,
	conditions: CharacterModifierConditionChainSchema,
});
/** Client data of a character modifier instance */
export type CharacterModifierInstanceClientData = z.infer<typeof CharacterModifierInstanceClientDataSchema>;

/** Client data of a character modifier template */
export const CharacterModifierTemplateSchema = z.object({
	type: CharacterModifierTypeSchema,
	name: CharacterModifierNameSchema,
	config: CharacterModifierConfigurationSchema,
	conditions: CharacterModifierConditionChainSchema,
});
/** Client data of a character modifier template */
export type CharacterModifierTemplate = z.infer<typeof CharacterModifierTemplateSchema>;

/** Request for change to modifier configuration. */
export const CharacterModifierConfigurationChangeSchema = z.object({
	name: CharacterModifierNameSchema.optional(),
	enabled: z.boolean().optional(),
	config: CharacterModifierConfigurationSchema.optional(),
	conditions: CharacterModifierConditionChainSchema.optional(),
});
/** Request for change to modifier configuration. */
export type CharacterModifierConfigurationChange = z.infer<typeof CharacterModifierConfigurationChangeSchema>;

/** Data of modifier instance effect - put onto a character if the modifier is active */
export const CharacterModifierEffectDataSchema = z.object({
	id: CharacterModifierIdSchema,
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

/** Create template data from client instance data */
export function MakeCharacterModifierTemplateFromClientData(data: CharacterModifierInstanceClientData): CharacterModifierTemplate {
	return {
		type: data.type,
		name: data.name,
		config: cloneDeep(data.config),
		conditions: cloneDeep(data.conditions),
	};
}
