import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { ICharacterData } from '../character';

/** Shard->Client handlers */
interface ShardClient {
	loadCharacter: (args: ICharacterData) => void;
	updateCharacter: (args: Partial<ICharacterData>) => void;
}

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
