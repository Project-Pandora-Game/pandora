import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { IEmpty } from './empty';
import type { ICharacterDataCreate } from '../character';

/** Client->Shard handlers */
interface ClientShard {
	disconnectCharacter: (_: IEmpty) => void;

	finishCharacterCreation: (args: ICharacterDataCreate) => void;
}

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
