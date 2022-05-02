import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { CharacterId } from '../character';
import type { MessageHandler } from './message_handler';
import type { IChatRoomFullInfo, IChatroomsLeaveReasonRecord, RoomId } from '../chatroom';
import { IEmpty } from './empty';

export type IShardCharacterDefinition = {
	id: CharacterId;
	account: number;
	accessId: string;
	connectSecret: string;
	room: RoomId | null;
};

/** Directory->Shard handlers */
interface DirectoryShard {
	prepareCharacters(arg: {
		characters: IShardCharacterDefinition[];
		rooms: IChatRoomFullInfo[];
		roomLeaveReasons: IChatroomsLeaveReasonRecord;
	}): void;
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
