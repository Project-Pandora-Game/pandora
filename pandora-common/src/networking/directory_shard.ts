import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified } from './helpers';
import { CharacterIdSchema } from '../character';
import { IChatRoomFullInfo, RoomId, RoomIdSchema } from '../chatroom/room';
import { IEmpty } from './empty';
import type { IChatRoomMessageDirectoryAction } from '../chatroom';
import { z } from 'zod';
import { AccountRoleInfoSchema } from '../account';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';

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

export type IDirectoryShardUpdate = {
	/** List of characters connected to this shard (both outside and in room) */
	characters: IShardCharacterDefinition[];
	/** List of rooms which exist on this shard */
	rooms: IChatRoomFullInfo[];
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
} as const;

export type IDirectoryShard = Satisfies<typeof DirectoryShardSchema, SocketInterfaceDefinitionVerified<typeof DirectoryShardSchema>>;
export type IDirectoryShardArgument = SocketInterfaceRequest<IDirectoryShard>;
export type IDirectoryShardResult = SocketInterfaceHandlerResult<IDirectoryShard>;
export type IDirectoryShardPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryShard>;
export type IDirectoryShardNormalResult = SocketInterfaceResponse<IDirectoryShard>;
