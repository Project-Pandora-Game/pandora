import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { CharacterIdSchema } from '../character';
import type { MessageHandler } from './message_handler';
import { IChatRoomFullInfo, RoomId, RoomIdSchema } from '../chatroom/room';
import { IEmpty } from './empty';
import type { IChatRoomMessageDirectoryAction } from '../chatroom';
import { z } from 'zod';
import { AccountRoleInfoSchema } from '../account';

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

/** Directory->Shard handlers */
interface DirectoryShard {
	update(arg: Partial<IDirectoryShardUpdate>): Promise<IEmpty>;
	stop(arg: IEmpty): IEmpty;
}

export type IDirectoryShard = SocketInterface<DirectoryShard>;
export type IDirectoryShardArgument = RecordOnly<SocketInterfaceArgs<DirectoryShard>>;
export type IDirectoryShardUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<DirectoryShard>;
export type IDirectoryShardResult = SocketInterfaceResult<DirectoryShard>;
export type IDirectoryShardPromiseResult = SocketInterfacePromiseResult<DirectoryShard>;
export type IDirectoryShardNormalResult = SocketInterfaceNormalResult<DirectoryShard>;
export type IDirectoryShardResponseHandler = SocketInterfaceResponseHandler<DirectoryShard>;
export type IDirectoryShardOneshotHandler = SocketInterfaceOneshotHandler<DirectoryShard>;
export type IDirectoryShardMessageHandler<Context> = MessageHandler<DirectoryShard, Context>;
export type IDirectoryShardBase = DirectoryShard;
