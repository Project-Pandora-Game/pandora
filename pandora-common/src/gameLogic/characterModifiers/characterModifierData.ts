import { cloneDeep } from 'lodash-es';
import * as z from 'zod';
import { AssetIdSchema } from '../../assets/base.ts';
import { CharacterIdSchema } from '../../character/characterTypes.ts';
import { LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT } from '../../inputLimits.ts';
import type { Satisfies } from '../../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../../validation.ts';
import { LockActionSchema, type LockActionLockProblem, type LockActionShowPasswordProblem, type LockActionUnlockProblem, type LockActionUpdateFingerprintProblem } from '../locks/lockLogic.ts';
import { PermissionConfigSchema } from '../permissions/index.ts';
import { CharacterModifierConfigurationSchema, CharacterModifierIdSchema, CharacterModifierNameSchema, CharacterModifierTypeGenericIdSchema, type CharacterModifierId } from './characterModifierBaseData.ts';
import { CharacterModifierLockSchema } from './characterModifierLocks.ts';
import { CharacterModifierConditionChainSchema } from './conditions/characterModifierConditionChain.ts';
import { CharacterModifierTypeSchema, type CharacterModifierSpecificConfig, type CharacterModifierType } from './modifierTypes/_index.ts';

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
	/** Lock on the modifier, if any */
	lock: CharacterModifierLockSchema.optional().catch(undefined),
	/** List of characters that can simply ignore any locked lock on it */
	lockExceptions: CharacterIdSchema.array().max(LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT).catch(() => []),
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
	lock: CharacterModifierLockSchema.optional(),
	lockExceptions: CharacterIdSchema.array().max(LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT),
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
	lockExceptions: CharacterIdSchema.array().max(LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT).optional(),
});
/** Request for change to modifier configuration. */
export type CharacterModifierConfigurationChange = z.infer<typeof CharacterModifierConfigurationChangeSchema>;

export const CharacterModifierLockActionSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('addLock'),
		lockAsset: AssetIdSchema,
	}),
	z.object({
		action: z.literal('removeLock'),
	}),
	z.object({
		action: z.literal('lockAction'),
		lockAction: LockActionSchema,
	}),
]);
export type CharacterModifierLockAction = z.infer<typeof CharacterModifierLockActionSchema>;

export type CharacterModifierActionError =
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'lock';
		reason: LockActionLockProblem;
	}
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'unlock';
		reason: LockActionUnlockProblem;
	}
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'showPassword';
		reason: LockActionShowPasswordProblem;
	}
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'updateFingerprint';
		reason: LockActionUpdateFingerprintProblem;
	};

/** Data of modifier instance effect - put onto a character if the modifier is active */
export const CharacterModifierEffectDataSchema = z.object({
	id: CharacterModifierIdSchema,
	type: CharacterModifierTypeSchema,
	config: CharacterModifierConfigurationSchema,
});
/** Data of modifier instance effect - put onto a character if the modifier is active */
export type CharacterModifierEffectData = z.infer<typeof CharacterModifierEffectDataSchema>;

export type CharacterModifierEffectDataSpecific<TType extends CharacterModifierType> = Satisfies<{
	id: CharacterModifierId;
	type: TType;
	config: CharacterModifierSpecificConfig<TType>;
}, CharacterModifierEffectData>;

/** Data of the whole character modifer subsystem, saved on character in database */
export const CharacterModifierSystemDataSchema = z.object({
	modifiers: ZodArrayWithInvalidDrop(CharacterModifierInstanceDataSchema, z.record(z.string(), z.unknown())),
	typeConfig: z.partialRecord(CharacterModifierTypeGenericIdSchema, CharacterModifierTypeConfigSchema.optional()),
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
