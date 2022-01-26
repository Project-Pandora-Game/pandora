import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { MessageHandler } from './message_handler';

/** Client->Shard handlers */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ClientShard { }

export type IClientShard = SocketInterface<ClientShard>;
export type IClientShardArgument = RecordOnly<SocketInterfaceArgs<ClientShard>>;
export type IClientShardUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ClientShard>;
export type IClientShardResult = SocketInterfaceResult<ClientShard>;
export type IClientShardPromiseResult = SocketInterfacePromiseResult<ClientShard>;
export type IClientShardNormalResult = SocketInterfaceNormalResult<ClientShard>;
export type IClientShardResponseHandler = SocketInterfaceResponseHandler<ClientShard>;
export type IClientShardOneshotHandler = SocketInterfaceOneshotHandler<ClientShard>;
export type IClientShardMessageHandler<Context> = MessageHandler<ClientShard, Context>;
export type IClientShardBase = ClientShard;
