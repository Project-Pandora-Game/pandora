import { CharacterId } from '../character';
import type { ShardFeature } from '../networking/shard_directory';

export type RoomId = `r${string}`;

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

export type IChatRoomDirectoryUpdate = Partial<Omit<IChatRoomDirectoryConfig, 'features' | 'development'>>;

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

export type IChatRoomLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'kick' | 'ban';
export type IChatroomsLeaveReasonRecord = Record<RoomId, undefined | Record<CharacterId, undefined | IChatRoomLeaveReason>>;
