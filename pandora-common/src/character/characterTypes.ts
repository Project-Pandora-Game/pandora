import { z } from 'zod';
import { ZodMatcher, zTemplateString } from '../validation';

export const CharacterIdSchema = zTemplateString<`c${number}`>(z.string(), /^c[1-9][0-9]{0,15}$/);
export type CharacterId = z.infer<typeof CharacterIdSchema>;

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = ZodMatcher(CharacterIdSchema);
