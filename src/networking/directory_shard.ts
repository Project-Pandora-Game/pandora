import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { CharacterId } from '../character';
import type { MessageHandler } from './message_handler';

/** Directory->Shard handlers */
interface DirectoryShard {
	prepareClient: (arg: {
		characterId: CharacterId;
		connectionSecret: string;
		accessId: string;
	}) => {
		result: 'accepted' | 'rejected';
	};
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
