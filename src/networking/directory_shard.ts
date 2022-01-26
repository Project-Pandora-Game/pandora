import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { MessageHandler } from './message_handler';

/** Directory->Shard handlers */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DirectoryShard { }

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
