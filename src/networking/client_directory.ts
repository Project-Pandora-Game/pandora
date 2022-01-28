import { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import { IDirectoryClientConnectionStateUpdate } from './directory_client';
import { MessageHandler } from './message_handler';

/** Client->Directory handlers */
interface ClientDirectory {
	//#region Before Login
	login(arg: { username: string; passwordSha512: string; }): {
		result: 'ok' | 'unknownCredentials',
		token?: string,
		update: IDirectoryClientConnectionStateUpdate;
	};
	register(arg: { username: string; passwordSha512: string; email: string; }): {
		result: 'ok' | 'usernameTaken' | 'emailTaken',
	};
	verifyEmail(args: { username: string; token: string; }): {
		result: 'ok' | 'unknownCredentials' | 'invalidToken',
	};
	passwordReset(arg: { email: string; }): {
		result: 'maybeSent',
	};
	passwordResetConfirm(arg: { username: string; passwordSha512: string; token: string; }): {
		result: 'ok' | 'unknownCredentials',
	};
	//#endregion Before Login
	passwordChange(arg: { passwordSha512Old: string; passwordSha512New: string; }): {
		result: 'ok' | 'invalidPassword',
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
