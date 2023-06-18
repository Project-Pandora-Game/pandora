import { z } from 'zod';
import { ZodMatcher, ZodTemplateString } from '../validation';

export const CharacterIdSchema = ZodTemplateString<`c${number}`>(z.string(), /^c[0-9]+$/);
export type CharacterId = z.infer<typeof CharacterIdSchema>;

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = ZodMatcher(CharacterIdSchema);
