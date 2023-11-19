import { AccountTokenReason } from '../account/accountSecure';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	AccountCryptoKeySchema,
	AccountId,
	AccountIdSchema,
	DirectoryAccountSettingsSchema,
	IAccountRoleManageInfo,
	IBetaKeyInfo,
	IDirectoryDirectMessageInfo,
	IShardTokenInfo,
	ZodCast,
} from 'pandora-common';
import { z } from 'zod';
import { ICharacterSelfInfoDb } from './databaseProvider';
import { GitHubTeamSchema } from '../services/github/githubVerify';
import { cloneDeep } from 'lodash';

export const DatabaseAccountTokenSchema = z.object({
	/** The token secret */
	value: z.string(),
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expires: z.number(),
	/** The reason for this token */
	reason: z.nativeEnum(AccountTokenReason),
});
export type DatabaseAccountToken = z.infer<typeof DatabaseAccountTokenSchema>;

export const GitHubInfoSchema = z.object({
	id: z.number(),
	login: z.string(),
	role: z.enum(['admin', 'member', 'collaborator', 'none']),
	date: z.number(),
	teams: GitHubTeamSchema.array().optional(),
});
export type GitHubInfo = z.infer<typeof GitHubInfoSchema>;

export const DatabaseAccountSecureSchema = z.object({
	activated: z.boolean(),
	password: z.string(),
	emailHash: z.string(),
	tokens: DatabaseAccountTokenSchema.array(),
	github: GitHubInfoSchema.optional(),
	cryptoKey: AccountCryptoKeySchema.optional(),
});
export type DatabaseAccountSecure = z.infer<typeof DatabaseAccountSecureSchema>;

/** Direct message key create from the 2 accounts' id where the first is always the lowest */
export type DirectMessageAccounts = `${number}-${number}`;

export type DatabaseDirectMessageInfo = IDirectoryDirectMessageInfo & {
	/** Flag to indicate the conversation was closed and the info should not be sent to the account */
	closed?: true;
};

/** Representation of account stored in database */
export const DatabaseAccountSchema = z.object({
	username: z.string(),
	id: AccountIdSchema,
	created: z.number(),
	roles: ZodCast<IAccountRoleManageInfo>().optional(),
	characters: ZodCast<ICharacterSelfInfoDb>().array(),
	settings: DirectoryAccountSettingsSchema.catch(() => cloneDeep(ACCOUNT_SETTINGS_DEFAULT)),
	directMessages: ZodCast<DatabaseDirectMessageInfo>().array().optional(),
});
/** Representation of account stored in database */
export type DatabaseAccount = z.infer<typeof DatabaseAccountSchema>;

export const DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES = ['roles', 'characters', 'settings', 'directMessages'] satisfies readonly (keyof DatabaseAccount)[];
export type DatabaseAccountUpdateableProperties = (typeof DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES)[number];

export type DatabaseAccountRelationship = {
	type: 'friend' | 'mutualBlock';
} | {
	type: 'request' | 'oneSidedBlock';
	from: AccountId;
};

export interface DatabaseRelationship {
	accounts: [AccountId, AccountId];
	updated: number;
	relationship: DatabaseAccountRelationship;
}

/** Representation of account stored in database */
export const DatabaseAccountWithSecureSchema = DatabaseAccountSchema.extend({
	/** Secure account data - should never leave this server; all related to account security */
	secure: DatabaseAccountSecureSchema,
});
/** Representation of account stored in database */
export type DatabaseAccountWithSecure = z.infer<typeof DatabaseAccountWithSecureSchema>;

export type DatabaseConfig = {
	shardTokens: (IShardTokenInfo & { token: string; })[];
	betaKeys: (IBetaKeyInfo & { token: string; })[];
};

export type DatabaseConfigType = keyof DatabaseConfig;
export type DatabaseConfigData<T extends DatabaseConfigType> = DatabaseConfig[T];
