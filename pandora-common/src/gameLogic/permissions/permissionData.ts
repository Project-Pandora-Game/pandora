import { z } from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes';

export const PERMISSION_MAX_CHARACTER_OVERRIDES = 100;

export const PermissionGroupSchema = z.enum([
	'interaction',
	'assetPreferences',
	'characterModifierType',
]);

export type PermissionGroup = z.infer<typeof PermissionGroupSchema>;

export const PermissionTypeSchema = z.enum(['yes', 'no', 'prompt']);
export type PermissionType = z.infer<typeof PermissionTypeSchema>;
export type PermissionTypeInvalid = Exclude<PermissionType, 'yes'>;

export const PermissionConfigDefaultSchema = z.object({
	allowOthers: PermissionTypeSchema,
});

export type PermissionConfigDefault = z.infer<typeof PermissionConfigDefaultSchema>;

export const PermissionSetupSchema = z.object({
	group: PermissionGroupSchema,
	id: z.string(),
	displayName: z.string(),
	icon: z.string().optional(),
	defaultConfig: PermissionConfigDefaultSchema,
	forbidDefaultAllowOthers: z.array(PermissionTypeSchema).optional(),
	maxCharacterOverrides: z.number().int().positive().optional(),
});

export type PermissionSetup = z.infer<typeof PermissionSetupSchema>;

export const PermissionConfigSchema = PermissionConfigDefaultSchema.extend({
	characterOverrides: z.record(CharacterIdSchema, PermissionTypeSchema),
});

const PermissionConfigChangeSelectorSchema = CharacterIdSchema.or(z.enum(['default', 'clearOverridesWith']));
export type PermissionConfigChangeSelector = z.infer<typeof PermissionConfigChangeSelectorSchema>;

const PermissionConfigChangeTypeSchema = PermissionTypeSchema.or(z.enum(['accept'])).nullable();
export type PermissionConfigChangeType = z.infer<typeof PermissionConfigChangeTypeSchema>;

export const PermissionConfigChangeSchema = z.object({
	selector: PermissionConfigChangeSelectorSchema,
	allowOthers: PermissionConfigChangeTypeSchema,
}).nullable();
export type PermissionConfigChange = z.infer<typeof PermissionConfigChangeSchema>;

export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
