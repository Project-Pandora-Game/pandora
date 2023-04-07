import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified, SocketInterfaceDefinition } from './helpers';
import { CharacterIdSchema } from '../character';
import { ChatRoomDataSchema, RoomId, RoomIdSchema } from '../chatroom/room';
import { IEmpty } from './empty';
import type { IChatRoomMessageDirectoryAction } from '../chatroom';
import { z } from 'zod';
import { AccountRoleInfoSchema } from '../account';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';
import { Immutable } from 'immer';

export const ShardAccountDefinitionSchema = z.object({
	id: z.number(),
	roles: AccountRoleInfoSchema.optional(),
});
export type IShardAccountDefinition = z.infer<typeof ShardAccountDefinitionSchema>;

export const ShardCharacterDefinitionSchema = z.object({
	id: CharacterIdSchema,
	account: ShardAccountDefinitionSchema,
	accessId: z.string(),
	connectSecret: z.string(),
	room: RoomIdSchema.nullable(),
});
export type IShardCharacterDefinition = z.infer<typeof ShardCharacterDefinitionSchema>;

export const ShardChatRoomDefinitionSchema = ChatRoomDataSchema.pick({
	id: true,
	config: true,
	accessId: true,
	owners: true,
});
export type IShardChatRoomDefinition = z.infer<typeof ShardChatRoomDefinitionSchema>;

export type IDirectoryShardUpdate = {
	/** List of characters connected to this shard (both outside and in room) */
	characters: IShardCharacterDefinition[];
	/** List of rooms which exist on this shard */
	rooms: IShardChatRoomDefinition[];
	messages: Record<RoomId, IChatRoomMessageDirectoryAction[]>;
};

/** Directory->Shard messages */
export const DirectoryShardSchema = {
	update: {
		request: ZodCast<Partial<IDirectoryShardUpdate>>(),
		response: ZodCast<IEmpty>(),
	},
	stop: {
		request: ZodCast<IEmpty>(),
		response: ZodCast<IEmpty>(),
	},
	//#region Room manipulation
	roomCheckCanEnter: {
		request: z.object({
			character: CharacterIdSchema,
			room: RoomIdSchema,
		}),
		response: z.object({
			result: z.enum(['ok', 'targetNotFound']),
		}),
	},
	roomCheckCanLeave: {
		request: z.object({
			character: CharacterIdSchema,
		}),
		response: z.object({
			result: z.enum(['ok', 'targetNotFound', 'restricted']),
		}),
	},
	//#endregion
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IDirectoryShard = Satisfies<typeof DirectoryShardSchema, SocketInterfaceDefinitionVerified<typeof DirectoryShardSchema>>;
export type IDirectoryShardArgument = SocketInterfaceRequest<IDirectoryShard>;
export type IDirectoryShardResult = SocketInterfaceHandlerResult<IDirectoryShard>;
export type IDirectoryShardPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryShard>;
export type IDirectoryShardNormalResult = SocketInterfaceResponse<IDirectoryShard>;
