import { Immutable } from 'immer';
import { z } from 'zod';
import { AccountId, AccountIdSchema, IAccountRoleInfo, type AccountSettings, type AccountSettingsCooldowns } from '../account/index.ts';
import type { CharacterId } from '../character/index.ts';
import type { ShardFeature } from '../space/space.ts';
import { Satisfies } from '../utility/misc.ts';
import { ZodCast, type HexColorString } from '../validation.ts';
import type { IAccountContact, IAccountFriendStatus } from './client_directory.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

export type IDirectoryStatus = {
	time: number;
	onlineAccounts: number;
	onlineCharacters: number;
	betaKeyRequired?: true;
	captchaSiteKey?: string;
};
export function CreateDefaultDirectoryStatus(): IDirectoryStatus {
	return {
		time: Date.now(),
		onlineAccounts: 0,
		onlineCharacters: 0,
	};
}

// TODO: This needs reasonable size limits
export const AccountCryptoKeySchema = z.object({
	publicKey: z.string(),
	salt: z.string(),
	iv: z.string(),
	encryptedPrivateKey: z.string(),
});
export type IAccountCryptoKey = z.infer<typeof AccountCryptoKeySchema>;

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

export type IDirectoryCharacterConnectionInfo = {
	characterId: CharacterId;
	secret: string;
} & IDirectoryShardInfo;

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
			character: IDirectoryCharacterConnectionInfo | null;
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
	friendStatus: {
		request: ZodCast<IAccountFriendStatus | { id: AccountId; online: 'delete'; }>(),
		response: null,
	},
	accountContactUpdate: {
		request: ZodCast<{
			contact: IAccountContact | { id: AccountId; type: 'none'; };
			friendStatus: IAccountFriendStatus | { id: AccountId; online: 'delete'; };
		}>(),
		response: null,
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IDirectoryClient = Satisfies<typeof DirectoryClientSchema, SocketInterfaceDefinitionVerified<typeof DirectoryClientSchema>>;
export type IDirectoryClientArgument = SocketInterfaceRequest<IDirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceHandlerResult<IDirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceResponse<IDirectoryClient>;
