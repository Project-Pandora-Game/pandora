import { z } from 'zod';
import { IAccountRoleInfo, AccountRoleSchema } from '../account';
import type { CharacterId } from '../character';
import type { ShardFeature } from '../chatroom';
import { Satisfies } from '../utility';
import { HexColorStringSchema, ZodCast } from '../validation';
import { SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';

export type IDirectoryStatus = {
	time: number;
	betaKeyRequired?: true;
};

export const DirectoryAccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema),
	labelColor: HexColorStringSchema,
});
export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

export const ACCOUNT_SETTINGS_DEFAULT: IDirectoryAccountSettings = {
	visibleRoles: [],
	labelColor: '#ffffff',
};

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
	created: number;
	github?: { id: number; login: string };
	roles?: IAccountRoleInfo;
	settings: IDirectoryAccountSettings;
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

export type IDirectoryClientChangeEvents = 'characterList' | 'shardList' | 'roomList';

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
	id: number;
	/** Name of the account */
	name: string;
	/** Label color of the account */
	labelColor: string;
	/** Public key of the account */
	publicKeyData: string;
};

/** Direct message conversation info */
export type IDirectoryDirectMessageInfo = {
	/** Id of the other account */
	id: number;
	/** Name of the other account */
	account: string;
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
	somethingChanged: {
		request: ZodCast<{
			changes: IDirectoryClientChangeEvents[];
		}>(),
		response: null,
	},

	/** Broadcast message to for account's connections when a DM is sent */
	directMessageSent: {
		request: ZodCast<IDirectoryDirectMessage & {
			/** Target accountId */
			target: number;
		}>(),
		response: null,
	},
	/** Broadcast message to for account's connections when a DM is received */
	directMessageGet: {
		request: ZodCast<IDirectoryDirectMessage & {
			/** Account info for the sender */
			account: IDirectoryDirectMessageAccount;
		}>(),
		response: null,
	},
	directMessageAction: {
		request: ZodCast<{
			id: number;
			action: 'read' | 'close';
		}>(),
		response: null,
	},
} as const;

export type IDirectoryClient = Satisfies<typeof DirectoryClientSchema, SocketInterfaceDefinitionVerified<typeof DirectoryClientSchema>>;
export type IDirectoryClientArgument = SocketInterfaceRequest<IDirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceHandlerResult<IDirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceResponse<IDirectoryClient>;
