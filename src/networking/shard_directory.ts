import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { MessageHandler } from './message_handler';

/** Shard->Directory handlers */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ShardDirectory { }

export type IShardDirectory = SocketInterface<ShardDirectory>;
export type IShardDirectoryArgument = RecordOnly<SocketInterfaceArgs<ShardDirectory>>;
export type IShardDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ShardDirectory>;
export type IShardDirectoryResult = SocketInterfaceResult<ShardDirectory>;
export type IShardDirectoryPromiseResult = SocketInterfacePromiseResult<ShardDirectory>;
export type IShardDirectoryNormalResult = SocketInterfaceNormalResult<ShardDirectory>;
export type IShardDirectoryResponseHandler = SocketInterfaceResponseHandler<ShardDirectory>;
export type IShardDirectoryOneshotHandler = SocketInterfaceOneshotHandler<ShardDirectory>;
export type IShardDirectoryMessageHandler<Context> = MessageHandler<ShardDirectory, Context>;
export type IShardDirectoryBase = ShardDirectory;
