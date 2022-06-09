import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { ICharacterDataCreate, ICharacterPublicSettings } from '../character';
import type { AppearanceAction } from '../assets';
import type { IClientMessage } from '../chatroom/chat';

/** Client->Shard handlers */
interface ClientShard {
	finishCharacterCreation(args: ICharacterDataCreate): { result: 'ok' | 'failed'; };
	chatRoomMessage(arg: {
		messages: IClientMessage[];
	}): void;
	chatRoomMessageAck(arg: {
		lastTime: number;
	}): void;
	appearanceAction(action: AppearanceAction): void;
	updateSettings(settings: Partial<ICharacterPublicSettings>): void;
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
