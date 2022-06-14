import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { CharacterId, IsCharacterId } from '../character';
import type { MessageHandler } from './message_handler';
import type { IChatRoomFullInfo, RoomId } from '../chatroom/room';
import { IsRoomId } from '../chatroom/validation';
import { IEmpty } from './empty';
import { CreateNullableValidator, CreateObjectValidator, IsNumber, IsString } from '../validation';
import type { IChatRoomMessageDirectoryAction } from '../chatroom';

export type IShardCharacterDefinition = {
	id: CharacterId;
	account: number;
	accessId: string;
	connectSecret: string;
	room: RoomId | null;
};

export const IsIShardCharacterDefinition = CreateObjectValidator<IShardCharacterDefinition>({
	id: IsCharacterId,
	account: IsNumber,
	accessId: IsString,
	connectSecret: IsString,
	room: CreateNullableValidator(IsRoomId),
});

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
