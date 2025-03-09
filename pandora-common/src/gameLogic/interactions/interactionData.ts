import { z } from 'zod';
import { PermissionConfigSchema } from '../permissions/index.ts';

export const InteractionGenericIdSchema = z.string();
export type InteractionGenericId = z.infer<typeof InteractionGenericIdSchema>;

export const InteractionDataSchema = z.object({
	permissionConfig: PermissionConfigSchema.nullable().catch(null),
});
export type InteractionData = z.infer<typeof InteractionDataSchema>;

export const InteractionSystemDataSchema = z.object({
	config: z.record(InteractionGenericIdSchema, InteractionDataSchema),
});
export type InteractionSystemData = z.infer<typeof InteractionSystemDataSchema>;

export function MakeDefaultInteractionSystemData(): InteractionSystemData {
	return {
		config: {},
	};
}
