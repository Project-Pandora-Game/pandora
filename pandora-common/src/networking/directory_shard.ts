import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified, SocketInterfaceDefinition } from './helpers';
import { CharacterIdSchema } from '../character';
import { ChatRoomDataSchema, RoomIdSchema } from '../chatroom/room';
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
	/** Secret for client to connect; `null` means this character is only loaded in room, but not connected to ("offline") */
	connectSecret: z.string().nullable(),
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

export const DirectoryShardUpdateSchema = z.object({
	/** List of characters connected to this shard (both outside and in room) */
	characters: ShardCharacterDefinitionSchema.array(),
	/** List of rooms which exist on this shard */
	rooms: ShardChatRoomDefinitionSchema.array(),
	messages: z.record(RoomIdSchema, ZodCast<IChatRoomMessageDirectoryAction>().array()),
});
export type IDirectoryShardUpdate = z.infer<typeof DirectoryShardUpdateSchema>;

/** Directory->Shard messages */
export const DirectoryShardSchema = {
	update: {
		request: DirectoryShardUpdateSchema.partial(),
		response: z.object({}),
	},
	stop: {
		request: z.object({}),
		response: z.object({}),
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
