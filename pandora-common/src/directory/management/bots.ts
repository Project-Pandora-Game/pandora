import * as z from 'zod';
import { BotPublicInfoSchema } from '../../bots/botDefinition.ts';

export const ManagementBotInfoSchema = BotPublicInfoSchema.extend({
	created: z.int().nonnegative(),
	updated: z.int().nonnegative(),
	online: z.boolean(),
	lastUse: z.number().nullable(),
});
export type ManagementBotInfo = z.infer<typeof ManagementBotInfoSchema>;

export const ManagementBotQueryResultSchema = z.object({
	bots: ManagementBotInfoSchema.array(),
});
export type ManagementBotQueryResult = z.infer<typeof ManagementBotQueryResultSchema>;
