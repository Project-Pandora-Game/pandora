import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { MessageHandler } from './message_handler';

/** Shard->Client handlers */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ShardClient { }

export type IShardClient = SocketInterface<ShardClient>;
export type IShardClientArgument = RecordOnly<SocketInterfaceArgs<ShardClient>>;
export type IShardClientUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ShardClient>;
export type IShardClientResult = SocketInterfaceResult<ShardClient>;
export type IShardClientPromiseResult = SocketInterfacePromiseResult<ShardClient>;
export type IShardClientNormalResult = SocketInterfaceNormalResult<ShardClient>;
export type IShardClientResponseHandler = SocketInterfaceResponseHandler<ShardClient>;
export type IShardClientOneshotHandler = SocketInterfaceOneshotHandler<ShardClient>;
export type IShardClientMessageHandler<Context> = MessageHandler<ShardClient, Context>;
export type IShardClientBase = ShardClient;
