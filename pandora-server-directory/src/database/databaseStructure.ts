import {
	AccountCryptoKeySchema,
	AccountId,
	AccountIdSchema,
	AccountSettingsCooldownsSchema,
	AccountSettingsSchema,
	ArrayToRecordKeys,
	AssetFrameworkOutfitWithIdSchema,
	IAccountRoleManageInfo,
	IBetaKeyInfo,
	IDirectoryDirectMessageInfo,
	IShardTokenInfo,
	LIMIT_ACCOUNT_PROFILE_LENGTH,
	ZodCast,
	ZodTruncate,
} from 'pandora-common';
import { z } from 'zod';
import { AccountTokenReason } from '../account/accountSecure';
import { GitHubTeamSchema } from '../services/github/githubVerify';
import { ICharacterSelfInfoDb } from './databaseProvider';

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
	/**
	 * Settings of the account.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * Settings modified to the default are saved as well, so potential change of default wouldn't change the user-selected setting.
	 * This lets us both save on stored data, but also change defaults for users that never changed it themselves.
	 * Also lets us show non-default settings to users with a button to reset them.
	 */
	settings: AccountSettingsSchema.partial(),
	/**
	 * Cooldowns for limited settings.
	 *
	 * These represent time at which said setting can be changed again.
	 */
	settingsCooldowns: AccountSettingsCooldownsSchema.default(() => ({})),
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
	'settingsCooldowns',
	'directMessages',
	'storedOutfits',
] as const satisfies readonly (keyof DatabaseAccount)[];
export type DatabaseAccountUpdateableProperties = (typeof DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES)[number];

export const DatabaseAccountUpdateSchema = DatabaseAccountSchema.pick(ArrayToRecordKeys(DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, true)).partial();
export type DatabaseAccountUpdate = z.infer<typeof DatabaseAccountUpdateSchema>;

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
