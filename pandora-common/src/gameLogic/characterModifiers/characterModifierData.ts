import { z } from 'zod';
import { PermissionConfigSchema } from '../permissions';

export const CharacterModifierTypeGenericIdSchema = z.string();
export type CharacterModifierTypeGenericId = z.infer<typeof CharacterModifierTypeGenericIdSchema>;

export const CharacterModifierTypeConfigSchema = z.object({
	permission: PermissionConfigSchema.nullable().catch(null),
});
export type CharacterModifierTypeConfig = z.infer<typeof CharacterModifierTypeConfigSchema>;

export const CharacterModifierSystemDataSchema = z.object({
	typeConfig: z.record(CharacterModifierTypeGenericIdSchema, CharacterModifierTypeConfigSchema.optional()),
});
export type CharacterModifierSystemData = z.infer<typeof CharacterModifierSystemDataSchema>;

export function MakeDefaultCharacterModifierSystemData(): CharacterModifierSystemData {
	return {
		typeConfig: {},
	};
}
