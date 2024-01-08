import { AccountTokenReason } from '../account/accountSecure';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	ACCOUNT_SETTINGS_LIMITED_STORED_DEFAULT,
	AccountCryptoKeySchema,
	AccountId,
	AccountIdSchema,
	AssetFrameworkOutfitWithIdSchema,
	DirectoryAccountSettingsLimitedStoredSchema,
	DirectoryAccountSettingsSchema,
	IAccountRoleManageInfo,
	IBetaKeyInfo,
	IDirectoryDirectMessageInfo,
	IShardTokenInfo,
	LIMIT_ACCOUNT_PROFILE_LENGTH,
	ZodCast,
	ZodTruncate,
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

// changes to this type may require database migration
export type DatabaseDirectMessageInfo = Omit<IDirectoryDirectMessageInfo, 'displayName'> & {
	/** Flag to indicate the conversation was closed and the info should not be sent to the account */
	closed?: true;
};

/** Representation of account stored in database */
export const DatabaseAccountSchema = z.object({
	username: z.string(),
	id: AccountIdSchema,
	created: z.number(),
	roles: ZodCast<IAccountRoleManageInfo>().optional(),
	profileDescription: z.string().default('').transform(ZodTruncate(LIMIT_ACCOUNT_PROFILE_LENGTH)),
	characters: ZodCast<ICharacterSelfInfoDb>().array(),
	settings: DirectoryAccountSettingsSchema.catch(() => cloneDeep(ACCOUNT_SETTINGS_DEFAULT)),
	settingsLimited: DirectoryAccountSettingsLimitedStoredSchema.catch(() => cloneDeep(ACCOUNT_SETTINGS_LIMITED_STORED_DEFAULT)),
	directMessages: ZodCast<DatabaseDirectMessageInfo>().array().optional(),
	storedOutfits: AssetFrameworkOutfitWithIdSchema.array().catch(() => []),
});
/** Representation of account stored in database */
export type DatabaseAccount = z.infer<typeof DatabaseAccountSchema>;

export const DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES = [
	'roles',
	'profileDescription',
	'characters',
	'settings',
	'directMessages',
	'storedOutfits',
] satisfies readonly (keyof DatabaseAccount)[];
export type DatabaseAccountUpdateableProperties = (typeof DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES)[number];

export type DatabaseAccountContactType = {
	type: 'friend' | 'mutualBlock';
} | {
	type: 'request' | 'oneSidedBlock';
	from: AccountId;
};

export interface DatabaseAccountContact {
	accounts: [AccountId, AccountId];
	updated: number;
	contact: DatabaseAccountContactType;
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
