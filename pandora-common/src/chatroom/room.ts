import { z } from 'zod';
import { ZodTrimedRegex, zTemplateString } from '../validation';
import { Satisfies } from '../utility';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

export const RoomIdSchema = zTemplateString<`r${string}`>(z.string(), /^r/);
export type RoomId = z.infer<typeof RoomIdSchema>;

export type ChatRoomFeature = ShardFeature;

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

export const ChatRoomBaseInfoSchema = z.object({
	name: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\- ]+$/).regex(ZodTrimedRegex),
	description: z.string(),
	protected: z.boolean(),
	maxUsers: z.number().min(2),
});

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__ChatRoomBaseInfo = Satisfies<z.infer<typeof ChatRoomBaseInfoSchema>, IChatRoomBaseInfo>;

export type IChatRoomDirectoryConfig = IChatRoomBaseInfo & {
	/** The requested features */
	features: ChatRoomFeature[];
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development?: {
		/** The id of the shard that the room will be created on */
		shardId?: string;
	};
	/** The banned account ids */
	banned: number[];
	/** The admin account ids */
	admin: number[];
	/** The password of the chat room if the room is protected */
	password: string | null;
};

export const ChatRoomDirectoryConfigSchema = ChatRoomBaseInfoSchema.merge(z.object({
	features: z.array(ShardFeatureSchema),
	development: z.object({
		shardId: z.string().optional(),
	}).optional(),
	banned: z.array(z.number()),
	admin: z.array(z.number()),
	password: z.string().nullable(),
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
