import { z } from 'zod';
import { PermissionConfigSchema } from '../permissions';

export const InteractionGenericIdScheme = z.string();
export type InteractionGenericId = z.infer<typeof InteractionGenericIdScheme>;

export const InteractionDataScheme = z.object({
	permissionConfig: PermissionConfigSchema.nullable(),
});
export type InteractionData = z.infer<typeof InteractionDataScheme>;

export const InteractionSystemDataSchema = z.object({
	config: z.record(InteractionGenericIdScheme, InteractionDataScheme),
});
export type InteractionSystemData = z.infer<typeof InteractionSystemDataSchema>;

export function MakeDefaultInteractionSystemData(): InteractionSystemData {
	return {
		config: {},
	};
}
