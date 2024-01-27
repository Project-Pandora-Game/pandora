import { z } from 'zod';
import { IAccountRoleInfo, AccountRoleSchema, AccountId } from '../account';
import type { CharacterId } from '../character';
import type { ShardFeature } from '../space/space';
import { KnownObject, ParseArrayNotEmpty, Satisfies, TimeSpanMs } from '../utility';
import { DisplayNameSchema, HexColorStringSchema, ZodCast } from '../validation';
import type { IAccountContact, IAccountFriendStatus } from './client_directory';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';
import { Immutable } from 'immer';

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
	visibleRoles: z.array(AccountRoleSchema).max(AccountRoleSchema.options.length),
	labelColor: HexColorStringSchema.catch('#ffffff'),
	displayName: DisplayNameSchema.nullable().catch(null),
	/** Hides online status from friends */
	hideOnlineStatus: z.boolean().default(false),
	/**
	 * - 'all' - Allow direct messages from anyone
	 * - 'room' - Allow direct messages from friends and people in the same space | TODO(spaces): Update?
	 * - 'friends' - Only allow direct messages from friends
	 */
	allowDirectMessagesFrom: z.enum(['all', 'room', 'friends']).default('all'),
	/**
	 * Controls whether to show extra quick actions in wardrobe
	 * (actions that are doable with multiple clicks even without this button, but the button allows doing them as single click)
	 */
	wardrobeExtraActionButtons: z.boolean().catch(true),
	/**
	 * Controls whether to show character preview when hovering over an action button.
	 * (when action is possible the character preview shows the result state while hovering)
	 */
	wardrobeHoverPreview: z.boolean().catch(true),
	/**
	 * If outfits tab should generate previews for outfits and if the previews should be small or big.
	 */
	wardrobeOutfitsPreview: z.enum(['disabled', 'small', 'big']).default('small'),
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Color to use as wardrobe character preview background, unless room background is used (see `wardrobeUseRoomBackground` setting).
	 */
	wardrobeBackground: HexColorStringSchema.catch('#aaaaaa'),
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Controls whether wardrobe should use the room's background, if character is in a room.
	 * If character is not in the room, or if this is `false`, then `wardrobeBackground` setting is used.
	 */
	wardrobeUseRoomBackground: z.boolean().catch(true),
	/**
	 * Controls whether to show the attribute icons or preview images in small preview.
	 */
	wardrobeSmallPreview: z.enum(['icon', 'image']).default('image'),
	/**
	 * Controls whether to show the attribute icons or preview images in big preview.
	 */
	wardrobeBigPreview: z.enum(['icon', 'image']).default('image'),
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in horizontal mode
	 */
	interfaceChatroomGraphicsRatioHorizontal: z.number().int().min(1).max(9).catch(7),
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in vertical mode
	 */
	interfaceChatroomGraphicsRatioVertical: z.number().int().min(1).max(9).catch(4),
	/**
	 * Controls how offline characters are displayed in a room:
	 * - None: No difference between online and offline characters
	 * - Icon: Show disconnected icon under the name (not shown on other options)
	 * - Darken: The characters are darkened (similar to blindness)
	 * - Ghost: Darken + semi-transparent
	 */
	interfaceChatroomOfflineCharacterFilter: z.enum(['none', 'icon', 'darken', 'ghost']).default('ghost'),
	/**
	 * Controls how big the font size used in the main chat area is
	 */
	interfaceChatroomChatFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']).default('m'),
});

export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

export const ACCOUNT_SETTINGS_DEFAULT = Object.freeze<IDirectoryAccountSettings>({
	visibleRoles: [],
	labelColor: '#ffffff',
	displayName: null,
	hideOnlineStatus: false,
	allowDirectMessagesFrom: 'all',
	wardrobeExtraActionButtons: true,
	wardrobeBackground: '#aaaaaa',
	wardrobeUseRoomBackground: true,
	wardrobeHoverPreview: true,
	wardrobeOutfitsPreview: 'small',
	wardrobeSmallPreview: 'image',
	wardrobeBigPreview: 'image',
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
	interfaceChatroomOfflineCharacterFilter: 'ghost',
	interfaceChatroomChatFontSize: 'm',
});

export const ACCOUNT_SETTINGS_LIMITED_LIMITS = Object.freeze({
	displayName: TimeSpanMs(1, 'weeks'),
} as const satisfies Partial<Record<keyof IDirectoryAccountSettings, number>>);

export const DirectoryAccountSettingsLimitedKeysSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(ACCOUNT_SETTINGS_LIMITED_LIMITS)));
export type DirectoryAccountSettingsLimitedKeys = z.infer<typeof DirectoryAccountSettingsLimitedKeysSchema>;

export const DirectoryAccountSettingsCooldownsSchema = z.record(DirectoryAccountSettingsLimitedKeysSchema, z.number().optional());
export type DirectoryAccountSettingsCooldowns = z.infer<typeof DirectoryAccountSettingsCooldownsSchema>;

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
	settings: IDirectoryAccountSettings;
	settingsCooldowns: DirectoryAccountSettingsCooldowns;
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

export type IDirectoryClientChangeEvents = 'characterList' | 'shardList' | 'spaceList' | 'storedOutfits';

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
	labelColor: string;
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
