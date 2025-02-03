import { z } from 'zod';
import type { EffectsDefinition } from '../../assets/effects';
import { ZodTemplateString } from '../../validation';

/** Id of a character modifier type (any possible) */
export const CharacterModifierTypeGenericIdSchema = z.string();
/** Id of a character modifier type (any possible) */
export type CharacterModifierTypeGenericId = z.infer<typeof CharacterModifierTypeGenericIdSchema>;

/** Id of a character modifier instance */
export const CharacterModifierIdSchema = ZodTemplateString<`mod:${string}`>(z.string(), /^mod:/);
/** Id of a character modifier instance */
export type CharacterModifierId = z.infer<typeof CharacterModifierIdSchema>;

export const CharacterModifierConfigurationSchema = z.record(z.unknown());
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

/**
 * Properties (effects) that can be applied by modifiers.
 *
 * Modifier instance config __must__ always be the first argument.
 */
export interface CharacterModifierProperties<TConfig> {
	/**
	 * Apply additional effects to the character.
	 * Higher priority modifiers are applied first.
	 * @param config - Config of this modifier
	 * @param currentEffects - Effects that are currently applied to the character (either by items or by higher-priority modifiers)
	 * @returns _Additional_ effects to apply. These get merged with `currentEffects`.
	 */
	applyCharacterEffects?(config: TConfig, currentEffects: EffectsDefinition): Readonly<Partial<EffectsDefinition>>;
}

/** A helper type that contains all of modifier properties hooks without their config argument. */
export type CharacterModifierPropertiesApplier = {
	readonly [t in keyof CharacterModifierProperties<unknown>]:
	NonNullable<CharacterModifierProperties<unknown>[t]> extends (config: infer TConfig, ...args: infer Args) => infer Return ?
	(...args: Args) => Return : never;
};
