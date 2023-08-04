import { z } from 'zod';
import { ZodTrimedRegex, ZodTemplateString, HexColorStringSchema, HexColorString } from '../validation';
import { cloneDeep } from 'lodash';
import { AssetManager, ROOM_INVENTORY_BUNDLE_DEFAULT } from '../assets';
import { CharacterId } from '../character';
import { AccountId, AccountIdSchema } from '../account/account';
import { RoomInventoryBundleSchema } from '../assets/state/roomState';
import { ArrayToRecordKeys } from '../utility';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

export const RoomIdSchema = ZodTemplateString<`r/${string}`>(z.string(), /^r\//);
export type RoomId = z.infer<typeof RoomIdSchema>;

export const ChatRoomFeatureSchema = z.enum([
	// Allows characters inside to change their body
	'allowBodyChanges',
	// Allows characters inside to change their pronouns
	'allowPronounChanges',
	// Enables development options for the room
	'development',
]);
export type ChatRoomFeature = z.infer<typeof ChatRoomFeatureSchema>;

export type ActionRoomContext = {
	features: readonly ChatRoomFeature[];
};

export const ChatRoomBaseInfoSchema = z.object({
	/** The name of the chat room */
	name: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\- ]+$/).regex(ZodTrimedRegex),
	/** The description of the chat room */
	description: z.string(),
	/** Rooms are private by default and can be published to be seen in room search. */
	public: z.boolean(),
	/** The maximum amount of users in the chat room */
	maxUsers: z.number().min(2),
});
export type IChatRoomBaseInfo = z.infer<typeof ChatRoomBaseInfoSchema>;

export const ChatRoomBackgroundDataSchema = z.object({
	/** The background image of the chat room */
	image: z.string(),
	/** The size of the chat room */
	size: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
	/** Limit how high can character move */
	maxY: z.number().int().min(0).optional(),
	/** The Y -> scale of the chat room */
	scaling: z.number().min(0),
});
export type IChatroomBackgroundData = z.infer<typeof ChatRoomBackgroundDataSchema>;

export const DEFAULT_ROOM_SIZE = [4000, 2000] as const;
export const DEFAULT_BACKGROUND = {
	image: '#1099bb',
	size: cloneDeep(DEFAULT_ROOM_SIZE) as [number, number],
	scaling: 1,
} as const satisfies Readonly<IChatroomBackgroundData & { image: HexColorString; }>;

/**
 * Resolves chatroom background data into effective background info
 * @param assetManager - Asset manager to query for backgrounds
 * @param background - The background to resolve
 * @param baseUrl - Base URL to use for resolving image path, otherwise no change
 */
export function ResolveBackground(assetManager: AssetManager, background: string | IChatroomBackgroundData, baseUrl?: string): Readonly<IChatroomBackgroundData> {
	let roomBackground: Readonly<IChatroomBackgroundData> = DEFAULT_BACKGROUND;

	if (typeof background === 'string') {
		const definition = assetManager.getBackgroundById(background);
		if (definition) {
			roomBackground = baseUrl ? {
				...definition,
				image: baseUrl + definition.image,
			} : definition;
		}
	} else {
		roomBackground = background;
	}

	return roomBackground;
}

/** What is the minimal scale allowed for character inside room. */
export const CHARACTER_MIN_SIZE = 0.05;

/** Calculates maximum Y coordinate for character in room based on background config */
export function CalculateCharacterMaxYForBackground(roomBackground: IChatroomBackgroundData): number {
	// Y is limited by room size, but also by background and by lowest achievable character size
	return Math.floor(Math.min(
		roomBackground.maxY != null ? Math.min(roomBackground.maxY, roomBackground.size[1]) : roomBackground.size[1],
		(1 - CHARACTER_MIN_SIZE) * roomBackground.size[1] / roomBackground.scaling,
	));
}

export const ChatRoomDirectoryConfigSchema = ChatRoomBaseInfoSchema.merge(z.object({
	/** The requested features */
	features: z.array(ChatRoomFeatureSchema),
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development: z.object({
		/** The id of the shard that the room will be created on */
		shardId: z.string().optional(),
		/** Automatically grants admin to every developer on enter */
		autoAdmin: z.boolean().optional(),
	}).optional(),
	/** The banned account ids */
	banned: z.array(z.number()),
	/** The admin account ids */
	admin: z.array(z.number()),
	/** The password of the chat room if the room is protected */
	password: z.string().nullable(),
	/** The ID of the background or custom data */
	background: z.union([z.string(), ChatRoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]),
}));
export type IChatRoomDirectoryConfig = z.infer<typeof ChatRoomDirectoryConfigSchema>;

export const ChatRoomDirectoryUpdateSchema = ChatRoomDirectoryConfigSchema.omit({ features: true, development: true }).partial();
export type IChatRoomDirectoryUpdate = z.infer<typeof ChatRoomDirectoryUpdateSchema>;

/** Info sent to client when searching for a room */
export type IChatRoomListInfo = IChatRoomBaseInfo & {
	/** The id of the room, never changes */
	id: RoomId;
	/** Indicated if a password is available */
	hasPassword: boolean;
	/** The amount of users in the chat room */
	users: number;
	/** Whether the account that requested the info is owner of this room */
	isOwner: boolean;
};

/** Info sent to client when displaying details about room */
export type IChatRoomListExtendedInfo = IChatRoomListInfo & Pick<IChatRoomDirectoryConfig, 'features' | 'admin' | 'background'> & {
	// Note: `isAdmin` is not part of the basic info (`IChatRoomListInfo`), as it has more complex check than `isOwner` and shouldn't be done en masse
	/** Whether the account that requested the info is admin of this room */
	isAdmin: boolean;
	owners: AccountId[];
	characters: {
		id: CharacterId;
		accountId: number;
		name: string;
	}[];
};

export const ChatRoomFullInfoSchema = ChatRoomDirectoryConfigSchema.merge(z.object({
	/** The id of the room, never changes */
	id: RoomIdSchema,
	/** Account IDs of accounts owning this room */
	owners: AccountIdSchema.array(),
}));
export type IChatRoomFullInfo = z.infer<typeof ChatRoomFullInfoSchema>;

/** Room data stored in database */
export const ChatRoomDataSchema = z.object({
	id: RoomIdSchema,
	accessId: z.string(),
	/** Account IDs of accounts owning this room */
	owners: AccountIdSchema.array(),
	config: ChatRoomDirectoryConfigSchema,
	inventory: RoomInventoryBundleSchema.default(() => cloneDeep(ROOM_INVENTORY_BUNDLE_DEFAULT)),
});
/** Room data stored in database */
export type IChatRoomData = z.infer<typeof ChatRoomDataSchema>;

export const CHATROOM_DIRECTORY_UPDATEABLE_PROPERTIES = ['config', 'owners'] as const satisfies readonly (keyof IChatRoomData)[];
export const ChatRoomDataDirectoryUpdateSchema = ChatRoomDataSchema.pick(ArrayToRecordKeys(CHATROOM_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type IChatRoomDataDirectoryUpdate = z.infer<typeof ChatRoomDataDirectoryUpdateSchema>;

export const CHATROOM_SHARD_UPDATEABLE_PROPERTIES = ['inventory'] as const satisfies readonly Exclude<keyof IChatRoomData, ((typeof CHATROOM_DIRECTORY_PROPERTIES)[number])>[];
export const ChatRoomDataShardUpdateSchema = ChatRoomDataSchema.pick(ArrayToRecordKeys(CHATROOM_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type IChatRoomDataShardUpdate = z.infer<typeof ChatRoomDataShardUpdateSchema>;

export const CHATROOM_DIRECTORY_PROPERTIES = ['id', 'config', 'owners', 'accessId'] as const satisfies readonly (keyof IChatRoomData)[];
/** Room data from database, only those relevant to Directory */
export const ChatRoomDirectoryDataSchema = ChatRoomDataSchema.pick(ArrayToRecordKeys(CHATROOM_DIRECTORY_PROPERTIES, true));
/** Room data from database, only those relevant to Directory */
export type IChatRoomDirectoryData = z.infer<typeof ChatRoomDirectoryDataSchema>;

export type IChatRoomLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'error' | 'kick' | 'ban';
