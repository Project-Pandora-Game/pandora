import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { IDirectoryClientConnectionStateUpdate } from './directory_client';
import { MessageHandler } from './message_handler';

/** Client->Directory handlers */
interface ClientDirectory {
	login(arg: { username: string; password: string; }): {
		result: 'ok' | 'unknownCredentials',
		token?: string,
		update: IDirectoryClientConnectionStateUpdate;
	};
}

export type IClientDirectory = SocketInterface<ClientDirectory>;
export type IClientDirectoryArgument = RecordOnly<SocketInterfaceArgs<ClientDirectory>>;
export type IClientDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceResult<ClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfacePromiseResult<ClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceNormalResult<ClientDirectory>;
export type IClientDirectoryResponseHandler = SocketInterfaceResponseHandler<ClientDirectory>;
export type IClientDirectoryOneshotHandler = SocketInterfaceOneshotHandler<ClientDirectory>;
export type IClientDirectoryMessageHandler<Context> = MessageHandler<ClientDirectory, Context>;
export type IClientDirectoryBase = ClientDirectory;
