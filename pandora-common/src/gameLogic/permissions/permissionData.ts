import { z } from 'zod';

export const PermissionGroupSchema = z.enum([
	'interaction',
	'assetPreferences',
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
	defaultConfig: PermissionConfigDefaultSchema,
});

export type PermissionSetup = z.infer<typeof PermissionSetupSchema>;

export const PermissionConfigSchema = PermissionConfigDefaultSchema.extend({

});

export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
