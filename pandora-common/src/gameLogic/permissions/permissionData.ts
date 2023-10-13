import { z } from 'zod';

export const PermissionGroupSchema = z.enum([
	'interaction',
]);

export type PermissionGroup = z.infer<typeof PermissionGroupSchema>;

export const PermissionConfigDefaultSchema = z.object({
	/**
	 * TEMPORARY
	 *
	 * If others are allowed access (simple yes/no)
	 */
	allowOthers: z.boolean(),
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
