import * as z from 'zod';
import { ZodMatcher, ZodTemplateString } from '../validation.ts';

export type CharacterId = `c${number}`;
export const CharacterIdSchema: z.ZodType<CharacterId> = ZodTemplateString<CharacterId>(z.string(), /^c[0-9]+$/);

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = ZodMatcher(CharacterIdSchema);

export function CompareCharacterIds(a: CharacterId, b: CharacterId): number {
	const aNum = Number.parseInt(a.substring(1));
	const bNum = Number.parseInt(b.substring(1));
	if (!isFinite(aNum) || !isFinite(bNum)) {
		return a.localeCompare(b);
	}
	return aNum - bNum;
}
