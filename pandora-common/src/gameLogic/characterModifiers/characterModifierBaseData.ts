import * as z from 'zod';
import { LIMIT_CHARACTER_MODIFIER_NAME_LENGTH } from '../../inputLimits.ts';
import { ZodTemplateString, ZodTrimedRegex } from '../../validation.ts';

/** Id of a character modifier type (any possible) */
export const CharacterModifierTypeGenericIdSchema = z.string();
/** Id of a character modifier type (any possible) */
export type CharacterModifierTypeGenericId = z.infer<typeof CharacterModifierTypeGenericIdSchema>;

/** Id of a character modifier instance */
export const CharacterModifierIdSchema = ZodTemplateString<`mod:${string}`>(z.string(), /^mod:/);
/** Id of a character modifier instance */
export type CharacterModifierId = z.infer<typeof CharacterModifierIdSchema>;

/** Name of a character modifier */
export const CharacterModifierNameSchema = z.string()
	.max(LIMIT_CHARACTER_MODIFIER_NAME_LENGTH)
	.regex(ZodTrimedRegex);

export const CharacterModifierConfigurationSchema = z.record(z.string(), z.unknown());
export type CharacterModifierConfiguration = z.infer<typeof CharacterModifierConfigurationSchema>;

/**
 * Category for how strictly is a modifier type perceived.
 * - `normal` - This is a normal modifier, "prompt" permission by default
 * - `strict` - This is a strict modifier, "no" permission by default, but users can still change it to "prompt" or even "yes"
 * - `extreme` - This is a strict modifier, "no" permission by default, and users can only change it to "prompt"
 */
export type CharacterModifierStrictnessCategory =
	| 'normal'
	| 'strict'
	| 'extreme';
