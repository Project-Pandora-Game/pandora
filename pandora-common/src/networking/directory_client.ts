import { Immutable } from 'immer';
import * as z from 'zod';
import { AccountContactsInitDataSchema, AccountContactsUpdateDataSchema, AccountId, AccountIdSchema, IAccountRoleInfo, type AccountSettings, type AccountSettingsCooldowns } from '../account/index.ts';
import type { CharacterId } from '../character/index.ts';
import type { IDirectoryStatus } from '../directory/status.ts';
import { LIMIT_ACCOUNT_CRYPTO_ENCRYPTED_PRIVATE_KEY_LENGTH, LIMIT_ACCOUNT_CRYPTO_IV_LENGTH, LIMIT_ACCOUNT_CRYPTO_PUBLIC_KEY_LENGTH, LIMIT_ACCOUNT_CRYPTO_SALT_LENGTH, LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH } from '../inputLimits.ts';
import type { ShardFeature } from '../space/space.ts';
import { Satisfies } from '../utility/misc.ts';
import { ZodBase64Regex, ZodCast, type HexColorString } from '../validation.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

const ZodBase64UrlRegex = /^[A-Za-z0-9_-]*$/;

/** @see https://www.w3.org/TR/webauthn-3/#credential-id */
const ACCOUNT_PASSKEY_CREDENTIAL_ID_LENGTH_MAX = 2048;
/** @see https://www.w3.org/TR/webauthn-3/#sctn-public-key-easy */
const ACCOUNT_PASSKEY_PUBLIC_KEY_LENGTH_MAX = 1024;
/** @see https://www.w3.org/TR/webauthn-3/#dictdef-collectedclientdata */
const ACCOUNT_PASSKEY_CLIENT_DATA_LENGTH_MAX = 4096;
/** @see https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data */
const ACCOUNT_PASSKEY_AUTHENTICATOR_DATA_LENGTH_MAX = 8192;
/** @see https://www.w3.org/TR/webauthn-3/#sctn-op-get-assertion */
const ACCOUNT_PASSKEY_SIGNATURE_LENGTH_MAX = 1024;
/** @see https://www.w3.org/TR/webauthn-3/#enumdef-authenticatortransport */
const ACCOUNT_PASSKEY_TRANSPORT_LENGTH_MAX = 16;
/** @see https://www.w3.org/TR/webauthn-3/#enumdef-authenticatortransport */
export const ACCOUNT_PASSKEY_TRANSPORT_COUNT_MAX = 8;

export const AccountPasskeyCredentialIdSchema = z.string().regex(ZodBase64UrlRegex).min(1).max(ACCOUNT_PASSKEY_CREDENTIAL_ID_LENGTH_MAX);
export const AccountPasskeyPublicKeySchema = z.string().regex(ZodBase64Regex).min(1).max(ACCOUNT_PASSKEY_PUBLIC_KEY_LENGTH_MAX);
export const AccountPasskeyClientDataSchema = z.string().regex(ZodBase64UrlRegex).min(1).max(ACCOUNT_PASSKEY_CLIENT_DATA_LENGTH_MAX);
export const AccountPasskeyAuthenticatorDataSchema = z.string().regex(ZodBase64UrlRegex).min(1).max(ACCOUNT_PASSKEY_AUTHENTICATOR_DATA_LENGTH_MAX);
export const AccountPasskeySignatureSchema = z.string().regex(ZodBase64UrlRegex).min(1).max(ACCOUNT_PASSKEY_SIGNATURE_LENGTH_MAX);
export const AccountPasskeyTransportSchema = z.string().max(ACCOUNT_PASSKEY_TRANSPORT_LENGTH_MAX);
export const AccountPasskeyNameSchema = z.string().trim().min(1).max(LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH);

export const AccountCryptoKeySchema = z.object({
	publicKey: z.string().regex(ZodBase64Regex).min(1).max(LIMIT_ACCOUNT_CRYPTO_PUBLIC_KEY_LENGTH),
	salt: z.string().regex(ZodBase64Regex).min(1).max(LIMIT_ACCOUNT_CRYPTO_SALT_LENGTH),
	iv: z.string().regex(ZodBase64Regex).min(1).max(LIMIT_ACCOUNT_CRYPTO_IV_LENGTH),
	encryptedPrivateKey: z.string().regex(ZodBase64Regex).min(1).max(LIMIT_ACCOUNT_CRYPTO_ENCRYPTED_PRIVATE_KEY_LENGTH),
});
export type IAccountCryptoKey = z.infer<typeof AccountCryptoKeySchema>;

export const AccountPasskeyInfoSchema = z.object({
	credentialId: AccountPasskeyCredentialIdSchema,
	name: AccountPasskeyNameSchema,
	created: z.number(),
	lastUsed: z.number().optional(),
});
export type IAccountPasskeyInfo = z.infer<typeof AccountPasskeyInfoSchema>;

export const AccountPasskeyCredentialSchema = AccountPasskeyInfoSchema.extend({
	publicKey: AccountPasskeyPublicKeySchema,
	signCount: z.number().int().nonnegative(),
	transports: AccountPasskeyTransportSchema.array().max(ACCOUNT_PASSKEY_TRANSPORT_COUNT_MAX).optional(),
	cryptoKey: AccountCryptoKeySchema,
});
export type IAccountPasskeyCredential = z.infer<typeof AccountPasskeyCredentialSchema>;

export type IDirectoryAccountInfo = {
	id: number;
	username: string;
	displayName: string;
	created: number;
	github?: { id: number; login: string; };
	roles?: IAccountRoleInfo;
	/** Limit of how many spaces this account can own */
	spaceOwnershipLimit: number;
	/**
	 * Modified settings of the account.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * Settings modified to the default are saved as well, so potential change of default wouldn't change the user-selected setting.
	 * This lets us both save on stored data, but also change defaults for users that never changed it themselves.
	 * Also lets us show non-default settings to users with a button to reset them.
	 */
	settings: Partial<AccountSettings>;
	/**
	 * Cooldowns for limited settings.
	 *
	 * These represent time at which said setting can be changed again.
	 */
	settingsCooldowns: AccountSettingsCooldowns;
	cryptoKey?: IAccountCryptoKey;
};

export type IDirectoryShardInfo = {
	id: string;
	publicURL: string;
	features: ShardFeature[];
	version: string;
};

export type IDirectoryCharacterConnectionInfo = IDirectoryShardInfo & { secret: string; };

export type IDirectoryCharacterAssignmentInfo = {
	characterId: CharacterId;
	shardConnection: IDirectoryCharacterConnectionInfo | null;
};

export type IDirectoryClientChangeEvents = 'characterList' | 'shardList' | 'spaceList' | 'storedOutfits' | 'storedPosePresets';

export type IDirectoryDirectMessage = {
	/** Encrypted content, or empty string if the message was deleted. */
	content: string;
	/** SHA-256 base64 hash from the public keys of the 2 parties, used to validate key change */
	keyHash: string;
	/** Source Account's id */
	source: number;
	/** Time the message was created, does not change when message is edited */
	time: number;
	/** Time the message was last edited. */
	edited?: number;
};

/** Account info for direct message conversation */
export type IDirectoryDirectMessageAccount = {
	/** Id of the account */
	id: AccountId;
	/** Display name of the account */
	displayName: string;
	/** Label color of the account */
	labelColor: HexColorString;
	/** Public key of the account */
	publicKeyData: string;
};

// changes to this type may require database migration
/** Direct message conversation info */
export type IDirectoryDirectMessageInfo = {
	/** Id of the other account */
	id: AccountId;
	/** Display ame of the other account */
	displayName: string;
	/** Flag to indicate that there are unread messages */
	hasUnread?: true;
	/** Last message time */
	time: number;
};

/** Directory->Client messages */
export const DirectoryClientSchema = {
	/** Generic message for Directory's current status */
	serverStatus: {
		request: ZodCast<IDirectoryStatus>(),
		response: null,
	},
	connectionState: {
		request: ZodCast<{
			account: IDirectoryAccountInfo | null;
			character: IDirectoryCharacterAssignmentInfo | null;
		}>(),
		response: null,
	},
	loginTokenChanged: {
		request: ZodCast<{
			value: string;
			expires: number;
		}>(),
		response: null,
	},
	somethingChanged: {
		request: ZodCast<{
			changes: IDirectoryClientChangeEvents[];
		}>(),
		response: null,
	},

	/** Broadcast message to for account's connections when a new DM message is sent/received */
	directMessageNew: {
		request: z.object({
			/** The other account Id */
			target: AccountIdSchema,
			/** The message itself */
			message: ZodCast<IDirectoryDirectMessage>(),
		}),
		response: null,
	},
	directMessageAction: {
		request: ZodCast<{
			id: AccountId;
			action: 'read' | 'close';
		}>(),
		response: null,
	},
	accountContactInit: {
		request: AccountContactsInitDataSchema,
		response: null,
	},
	accountContactUpdate: {
		request: AccountContactsUpdateDataSchema,
		response: null,
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IDirectoryClient = Satisfies<typeof DirectoryClientSchema, SocketInterfaceDefinitionVerified<typeof DirectoryClientSchema>>;
export type IDirectoryClientArgument = SocketInterfaceRequest<IDirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceHandlerResult<IDirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceResponse<IDirectoryClient>;
