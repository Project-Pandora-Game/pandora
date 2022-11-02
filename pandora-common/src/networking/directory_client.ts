import { z } from 'zod';
import { IAccountRoleInfo, AccountRoleSchema } from '../account';
import type { CharacterId } from '../character';
import type { ShardFeature } from '../chatroom';
import { HexColorStringSchema } from '../validation';
import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';

export type IDirectoryStatus = {
	time: number;
	betaKeyRequired?: true;
};

export const DirectoryAccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema),
	labelColor: HexColorStringSchema,
});
export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

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
	github?: { id: number; login: string; };
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

/** Directory->Client handlers */
interface DirectoryClient {
	/** Generic message for Directory's current status */
	serverStatus(arg: IDirectoryStatus): void;

	connectionState(arg: {
		account: IDirectoryAccountInfo | null,
		character: IDirectoryCharacterConnectionInfo | null,
	}): void;
	somethingChanged(arg: {
		changes: IDirectoryClientChangeEvents[];
	}): void;
	/** Broadcast message to for account's connections when a DM is sent */
	directMessageSent(message: IDirectoryDirectMessage & {
		/** Target accountId */
		target: number;
	}): void;
	/** Broadcast message to for account's connections when a DM is received */
	directMessageGet(message: IDirectoryDirectMessage & {
		/** Account info for the sender */
		account: IDirectoryDirectMessageAccount;
	}): void;
	directMessageAction(arg: {
		id: number;
		action: 'read' | 'close';
	}): void;
}

export type IDirectoryClient = SocketInterface<DirectoryClient>;
export type IDirectoryClientArgument = RecordOnly<SocketInterfaceArgs<DirectoryClient>>;
export type IDirectoryClientUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<DirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceResult<DirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfacePromiseResult<DirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceNormalResult<DirectoryClient>;
export type IDirectoryClientResponseHandler = SocketInterfaceResponseHandler<DirectoryClient>;
export type IDirectoryClientOneshotHandler = SocketInterfaceOneshotHandler<DirectoryClient>;
export type IDirectoryClientMessageHandler<Context> = MessageHandler<DirectoryClient, Context>;
export type IDirectoryClientBase = DirectoryClient;
