import { z } from 'zod';
import { IAccountRoleInfo, AccountRoleSchema, AccountId } from '../account';
import type { CharacterId } from '../character';
import type { ShardFeature } from '../chatroom';
import { Satisfies } from '../utility';
import { HexColorStringSchema, ZodCast } from '../validation';
import type { IAccountRelationship, IAccountFriendStatus } from './client_directory';
import { SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';

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

export const DirectoryAccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema),
	labelColor: HexColorStringSchema.catch('#ffffff'),
	/** Hides online status from friends */
	hideOnlineStatus: z.boolean().default(false),
	/**
	 * - 'all' - Allow direct messages from anyone
	 * - 'room' - Allow direct messages from friends and people in the same room
	 * - 'friends' - Only allow direct messages from friends
	 */
	allowDirectMessagesFrom: z.enum(['all', 'room', 'friends']).default('all'),
	/**
	 * Controls whether to show extra quick actions in wardrobe
	 * (actions that are doable with multiple clicks even without this button, but the button allows doing them as single click)
	 */
	wardrobeExtraActionButtons: z.boolean().catch(true),
	/**
	 * Color to use as wardrobe character preview background, unless room background is used (see `wardrobeUseRoomBackground` setting).
	 */
	wardrobeBackground: HexColorStringSchema.catch('#aaaaaa'),
	/**
	 * Controls whether wardrobe should use the room's background, if character is in a room.
	 * If character is not in the room, or if this is `false`, then `wardrobeBackground` setting is used.
	 */
	wardrobeUseRoomBackground: z.boolean().catch(true),
	/**
	 * Controls how many parts (of 10 total) the chatroom graphics takes inside chatroom, while in horizontal mode
	 */
	interfaceChatroomGraphicsRatioHorizontal: z.number().int().min(1).max(9).catch(7),
	/**
	 * Controls how many parts (of 10 total) the chatroom graphics takes inside chatroom, while in vertical mode
	 */
	interfaceChatroomGraphicsRatioVertical: z.number().int().min(1).max(9).catch(4),
});
export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

export const ACCOUNT_SETTINGS_DEFAULT = Object.freeze<IDirectoryAccountSettings>({
	visibleRoles: [],
	labelColor: '#ffffff',
	hideOnlineStatus: false,
	allowDirectMessagesFrom: 'all',
	wardrobeExtraActionButtons: true,
	wardrobeBackground: '#aaaaaa',
	wardrobeUseRoomBackground: true,
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
});

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
	/** Limit of how many rooms this account can own */
	roomOwnershipLimit: number;
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
			target: AccountId;
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
			id: AccountId;
			action: 'read' | 'close';
		}>(),
		response: null,
	},
	friendStatus: {
		request: ZodCast<IAccountFriendStatus | { id: AccountId; online: 'delete'; }>(),
		response: null,
	},
	relationshipsUpdate: {
		request: ZodCast<{
			relationship: IAccountRelationship | { id: AccountId; type: 'none'; };
			friendStatus: IAccountFriendStatus | { id: AccountId; online: 'delete'; };
		}>(),
		response: null,
	},
} as const;

export type IDirectoryClient = Satisfies<typeof DirectoryClientSchema, SocketInterfaceDefinitionVerified<typeof DirectoryClientSchema>>;
export type IDirectoryClientArgument = SocketInterfaceRequest<IDirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceHandlerResult<IDirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceResponse<IDirectoryClient>;
