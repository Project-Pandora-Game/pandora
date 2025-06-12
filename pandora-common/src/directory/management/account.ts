import { z } from 'zod';
import { AccountIdSchema } from '../../account/account.ts';
import type { IAccountRoleManageInfo } from '../../account/accountRoles.ts';
import { AccountOnlineStatusSchema } from '../../account/contacts.ts';
import { CharacterIdSchema } from '../../character/characterTypes.ts';
import { SpaceIdSchema } from '../../space/space.ts';
import { ZodCast } from '../../validation.ts';

export const ManagementAccountInfoSecureSchema = z.object({
	activated: z.boolean(),
	githubLink: ZodCast<{ id: number; login: string; }>().nullable(),
});
export type ManagementAccountInfoSecure = z.infer<typeof ManagementAccountInfoSecureSchema>;

export const ManagementAccountInfoCharacterSchema = z.object({
	id: CharacterIdSchema,
	name: z.string(),
	currentSpace: SpaceIdSchema.nullable(),
	inCreation: z.literal(true).optional(),
	state: z.string(),
});
export type ManagementAccountInfoCharacter = z.infer<typeof ManagementAccountInfoCharacterSchema>;

export const ManagementAccountInfoSchema = z.object({
	id: AccountIdSchema,
	username: z.string(),
	displayName: z.string(),
	onlineStatus: AccountOnlineStatusSchema.nullable(),
	created: z.number(),
	secure: ManagementAccountInfoSecureSchema,
	characters: ManagementAccountInfoCharacterSchema.array(),
	roles: ZodCast<IAccountRoleManageInfo>(),
});
export type ManagementAccountInfo = z.infer<typeof ManagementAccountInfoSchema>;

export const ManagementAccountQueryResultSchema = z.discriminatedUnion('result', [
	z.object({
		result: z.literal('ok'),
		info: ManagementAccountInfoSchema,
	}),
	z.object({
		result: z.literal('notFound'),
	}),
]);
export type ManagementAccountQueryResult = z.infer<typeof ManagementAccountQueryResultSchema>;
