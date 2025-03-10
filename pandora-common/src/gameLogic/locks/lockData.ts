import { z } from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes.ts';

export const LockDataBundleSchema = z.object({
	locked: z.object({
		/** Id of the character that locked the item */
		id: CharacterIdSchema,
		/** Name of the character that locked the item */
		name: z.string(),
		/** Time the item was locked */
		time: z.number(),
		/** Time the timer on the lock will expire, if lock includes a timer */
		lockedUntil: z.number().int().nonnegative().optional(),
	}).optional(),
	hidden: z.discriminatedUnion('side', [
		z.object({
			side: z.literal('server'),
			/** Password used to lock the item */
			password: z.string().optional(),
			/** Id of the character who set the password last time */
			passwordSetBy: CharacterIdSchema.optional(),
		}),
		z.object({
			side: z.literal('client'),
			/** Whether the item has a password */
			hasPassword: z.boolean().optional(),
		}),
	]).optional(),
});
export type LockDataBundle = z.infer<typeof LockDataBundleSchema>;
