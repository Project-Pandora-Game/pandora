import {
	AccountCryptoKeySchema,
	AccountId,
	AccountIdSchema,
	AccountManagementDisableInfoSchema,
	AccountSettingsCooldownsSchema,
	AccountSettingsSchema,
	ArrayToRecordKeys,
	AssetFrameworkOutfitWithIdSchema,
	AssetFrameworkPosePresetWithIdSchema,
	CharacterSelfInfoSchema,
	IAccountRoleManageInfo,
	IBetaKeyInfo,
	IDirectoryDirectMessageInfo,
	IShardTokenInfo,
	LIMIT_ACCOUNT_PROFILE_LENGTH,
	ZodArrayWithInvalidDrop,
	ZodCast,
	ZodTemplateString,
	ZodTruncate,
} from 'pandora-common';
import * as z from 'zod';
import { GitHubTeamSchema } from '../services/github/githubVerify.ts';

export enum AccountTokenReason {
	/** Account activation token */
	ACTIVATION = 1,
	/** Account password reset token */
	PASSWORD_RESET = 2,
	/** Account login token */
	LOGIN = 3,
}

export const DatabaseAccountTokenSchema = z.object({
	/** The token secret */
	value: z.string(),
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expires: z.number(),
	/** The reason for this token */
	reason: z.enum(AccountTokenReason),
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
	/** If this account has activated email */
	activated: z.boolean(),
	/** Password hash */
	password: z.string(),
	emailHash: z.string(),
	/** If this account has been disabled by moderator */
	disabled: AccountManagementDisableInfoSchema.optional(),
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

export const DatabaseDirectMessageAccountsKeySchema = ZodTemplateString<DirectMessageAccounts>(z.string(), /^\d+-\d+$/);

export const DatabaseDirectMessageSchema = z.object({
	content: z.string(),
	source: z.number(),
	time: z.number(),
	edited: z.number().optional().catch(undefined),
});
export type DatabaseDirectMessage = z.infer<typeof DatabaseDirectMessageSchema>;
export const DatabaseDirectMessageAccountsSchema = z.object({
	accounts: DatabaseDirectMessageAccountsKeySchema,
	keyHash: z.string(),
	messages: DatabaseDirectMessageSchema.array(),
});
export type DatabaseDirectMessageAccounts = z.infer<typeof DatabaseDirectMessageAccountsSchema>;

export const DatabaseCharacterSelfInfoSchema = CharacterSelfInfoSchema.omit({ state: true });
export type DatabaseCharacterSelfInfo = z.infer<typeof DatabaseCharacterSelfInfoSchema>;

/** Representation of account stored in database */
export const DatabaseAccountSchema = z.object({
	username: z.string(),
	id: AccountIdSchema,
	created: z.number(),
	/**
	 * Timestamp of last login (both normal and token-based count).
	 * Not filled for accounts that didn't complete activation.
	 */
	lastLogin: z.number().optional(),
	roles: ZodCast<IAccountRoleManageInfo>().optional(),
	profileDescription: z.string().transform(ZodTruncate(LIMIT_ACCOUNT_PROFILE_LENGTH)).catch(''),
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
	settingsCooldowns: AccountSettingsCooldownsSchema.catch(() => ({})),
	directMessages: ZodCast<DatabaseDirectMessageInfo>().array().optional(),
	storedOutfits: AssetFrameworkOutfitWithIdSchema.array().catch(() => []),
	storedPosePresets: ZodArrayWithInvalidDrop(AssetFrameworkPosePresetWithIdSchema, z.record(z.string(), z.unknown())).catch(() => []),
});
/** Representation of account stored in database */
export type DatabaseAccount = z.infer<typeof DatabaseAccountSchema>;

export const DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES = [
	'lastLogin',
	'roles',
	'profileDescription',
	'settings',
	'settingsCooldowns',
	'directMessages',
	'storedOutfits',
	'storedPosePresets',
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

export const DatabaseBetaRegistrationSchema = z.object({
	/** The Discord ID of the person that signed up for beta access */
	discordId: z.string(),
	/** Timestamp of the initial registration */
	registeredAt: z.number(),
	/** Assigned beta key (if any) */
	assignedKey: z.string().nullable(),
});
export type DatabaseBetaRegistration = z.infer<typeof DatabaseBetaRegistrationSchema>;

export const DatabaseConfigCreationCountersSchema = z.object({
	nextAccountId: z.number(),
	nextCharacterId: z.number(),
});
export type DatabaseConfigCreationCounters = z.infer<typeof DatabaseConfigCreationCountersSchema>;

export const DatabaseVersionConfigSchema = z.object({
	type: z.literal('version'),
	data: z.object({
		database: z.number().int().nonnegative(),
	}),
});
export type DatabaseVersionConfig = z.infer<typeof DatabaseVersionConfigSchema>;

export const DatabaseConfigSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('creationCounters'),
		data: DatabaseConfigCreationCountersSchema,
	}),
	z.object({
		type: z.literal('shardTokens'),
		data: ZodCast<(IShardTokenInfo & { token: string; })[]>(),
	}),
	z.object({
		type: z.literal('betaKeys'),
		data: ZodCast<(IBetaKeyInfo & { token: string; })[]>(),
	}),
	z.object({
		type: z.literal('betaRegistrations'),
		data: DatabaseBetaRegistrationSchema.array(),
	}),
	DatabaseVersionConfigSchema,
]);
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export type DatabaseConfigType = DatabaseConfig['type'];
export type DatabaseConfigData<T extends DatabaseConfigType> = (DatabaseConfig & { type: T; })['data'];
