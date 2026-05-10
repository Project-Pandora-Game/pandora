import * as z from 'zod';
import { CharacterIdSchema, type CharacterId } from '../../character/characterTypes.ts';

export interface LockDataBundle {
	locked?: {
		/** Id of the character that locked the item */
		id: CharacterId;
		/** Name of the character that locked the item */
		name: string;
		/** Time the item was locked */
		time: number;
		/** Time the timer on the lock will expire, if lock includes a timer */
		lockedUntil?: number;
		/** Whether the character that locked it is allowed to unlock the timer early */
		disallowEarlyUnlock?: boolean;
	};
	/** Data applicable only to locks with fingerprint */
	fingerprint?: {
		/** Registered prints on the lock */
		registered: readonly CharacterId[];
	};
	hidden?: {
		side: 'server';
		/** Password used to lock the item */
		password?: string;
		/** Id of the character who set the password last time */
		passwordSetBy?: CharacterId;
	} | {
		side: 'client';
		/** Whether the item has a password */
		hasPassword?: boolean;
	};
}

export const LockDataBundleSchema: z.ZodType<LockDataBundle> = z.object({
	locked: z.object({
		/** Id of the character that locked the item */
		id: CharacterIdSchema,
		/** Name of the character that locked the item */
		name: z.string(),
		/** Time the item was locked */
		time: z.number(),
		/** Time the timer on the lock will expire, if lock includes a timer */
		lockedUntil: z.number().int().nonnegative().optional(),
		/** Whether the character that locked it is allowed to unlock the timer early */
		disallowEarlyUnlock: z.boolean().optional(),
	}).optional(),
	/** Data applicable only to locks with fingerprint */
	fingerprint: z.object({
		/** Registered prints on the lock */
		registered: CharacterIdSchema.array().readonly(),
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

export interface LockTemplateData {
	/** Data applicable only to locks with fingerprint */
	fingerprint?: {
		/** Registered prints on the lock */
		registered: readonly CharacterId[];
	};
}
export const LockTemplateDataSchema: z.ZodType<LockTemplateData> = z.object({
	fingerprint: z.object({
		registered: CharacterIdSchema.array().readonly(),
	}).optional(),
});
