import { z } from 'zod';
import { ZodTrimedRegex, zTemplateString } from '../validation';
import { Satisfies } from '../utility';
import { cloneDeep } from 'lodash';
import { AssetManager } from '../assets';
import { CharacterId } from '../character';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

export const RoomIdSchema = zTemplateString<`r${string}`>(z.string(), /^r/);
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

export type IChatRoomBaseInfo = {
	/** The name of the chat room */
	name: string;
	/** The description of the chat room */
	description: string;
	/** Protected rooms can be entered only by admins or using password (if there is one set) */
	protected: boolean;
	/** The maximum amount of users in the chat room */
	maxUsers: number;
};

export type AppearanceActionRoomContext = {
	features: readonly ChatRoomFeature[];
};

export const ChatRoomBaseInfoSchema = z.object({
	name: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\- ]+$/).regex(ZodTrimedRegex),
	description: z.string(),
	protected: z.boolean(),
	maxUsers: z.number().min(2),
});

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__ChatRoomBaseInfo = Satisfies<z.infer<typeof ChatRoomBaseInfoSchema>, IChatRoomBaseInfo>;

export type IChatroomBackgroundData = {
	/** The background image of the chat room */
	image: string;
	/** The size of the chat room */
	size: [number, number];
	/** Limit how high can character move */
	maxY?: number;
	/** The Y -> scale of the chat room */
	scaling: number;
};

export const ChatRoomBackgroundDataSchema = z.object({
	image: z.string(),
	size: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
	maxY: z.number().int().min(0).optional(),
	scaling: z.number().min(0),
});

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__ChatRoomBackgroundData = Satisfies<z.infer<typeof ChatRoomBackgroundDataSchema>, IChatroomBackgroundData>;

export const DEFAULT_ROOM_SIZE = [4000, 2000] as const;
export const DEFAULT_BACKGROUND: Readonly<IChatroomBackgroundData> = {
	image: '#1099bb',
	size: cloneDeep(DEFAULT_ROOM_SIZE) as [number, number],
	scaling: 1,
};

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

export type IChatRoomDirectoryConfig = IChatRoomBaseInfo & {
	/** The requested features */
	features: ChatRoomFeature[];
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development?: {
		/** The id of the shard that the room will be created on */
		shardId?: string;
		/** Automatically grants admin to every developer on enter */
		autoAdmin?: boolean;
	};
	/** The banned account ids */
	banned: number[];
	/** The admin account ids */
	admin: number[];
	/** The password of the chat room if the room is protected */
	password: string | null;
	/** The ID of the background or custom data */
	background: string | IChatroomBackgroundData;
};

export const ChatRoomDirectoryConfigSchema = ChatRoomBaseInfoSchema.merge(z.object({
	features: z.array(ChatRoomFeatureSchema),
	development: z.object({
		shardId: z.string().optional(),
		autoAdmin: z.boolean().optional(),
	}).optional(),
	banned: z.array(z.number()),
	admin: z.array(z.number()),
	password: z.string().nullable(),
	background: z.union([z.string(), ChatRoomBackgroundDataSchema]),
}));

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__ChatRoomDirectoryConfig = Satisfies<z.infer<typeof ChatRoomDirectoryConfigSchema>, IChatRoomDirectoryConfig>;

export const ChatRoomDirectoryUpdateSchema = ChatRoomDirectoryConfigSchema.omit({ features: true, development: true }).partial();

export type IChatRoomDirectoryUpdate = z.infer<typeof ChatRoomDirectoryUpdateSchema>;

export type IChatRoomDirectoryInfo = IChatRoomBaseInfo & {
	/** The id of the room, never changes */
	id: RoomId;
	/** Indicated if a password is available */
	hasPassword: boolean;
	/** The amount of users in the chat room */
	users: number;
	// TODO
	// /** Info about the creator */
	// creator: {
	// 	/** The id of the creator */
	// 	id: string;
	// 	/** The name of the creator */
	// 	accountName: string;
	// 	/** The avatar of the creator */
	// 	characterName: string;
	// };
};

export type IChatRoomDirectoryExtendedInfo = IChatRoomDirectoryInfo & {
	characters: {
		id: CharacterId;
		accountId: number;
		name: string;
	}[];
};

export type IChatRoomFullInfo = IChatRoomDirectoryConfig & {
	/** The id of the room, never changes */
	id: RoomId;
};

export const ChatRoomFullInfoSchema = ChatRoomDirectoryConfigSchema.merge(z.object({
	id: RoomIdSchema,
}));

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__ChatRoomFullInfo = Satisfies<z.infer<typeof ChatRoomFullInfoSchema>, IChatRoomFullInfo>;

export type IChatRoomLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'kick' | 'ban';
