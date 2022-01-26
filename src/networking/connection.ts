import { IsObject } from '../validation';
import { DEFAULT_ACK_TIMEOUT } from './config';
import type { Logger } from '../logging';
import type { BoolSelect, MemberReturnType, MembersFirstArg } from '../utility';
import type { SocketInterfaceOneshotHandler, SocketInterfaceResponseHandler } from './helpers';

interface Emitter {
	emit(event: string, arg: unknown): void;
}

interface EmitterWithAck extends Emitter {
	timeout(seconds: number): EmitterWithAck;
	emit(event: string, arg: unknown): void;
	emit(event: string, arg: unknown, callback: (arg: unknown) => void): void;
}

export interface IConnectionBase<T> {
	/**
	 * Send a oneshot message to the client
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 */
	sendMessage<K extends keyof SocketInterfaceOneshotHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K]): void;
}

export interface IConnection<T, Undetermined extends boolean> extends IConnectionBase<T> {
	/**
	 * Send a message to the client and wait for a response
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 * @param timeout - Timeout in seconds
	 */
	awaitResponse<K extends keyof SocketInterfaceResponseHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K], timeout?: number): Promise<BoolSelect<Undetermined, Record<string, unknown>, MemberReturnType<T>[K]>>;
}

export class ConnectionBase<EmitterT extends Emitter, T> implements IConnectionBase<T> {
	protected readonly socket: EmitterT;
	protected readonly logger: Logger;
	constructor(socket: EmitterT, logger: Logger) {
		this.socket = socket;
		this.logger = logger;
	}
	sendMessage<K extends keyof SocketInterfaceOneshotHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K]): void {
		this.logger.debug(`\u25B2 message '${messageType}':`, message);
		this.socket.emit(messageType as string, message);
	}
}

export class Connection<EmitterT extends EmitterWithAck, T, Undetermined extends boolean = false> extends ConnectionBase<EmitterT, T> implements IConnection<T, Undetermined> {
	constructor(socket: EmitterT, logger: Logger) {
		super(socket, logger);
	}
	awaitResponse<K extends keyof SocketInterfaceResponseHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K], timeout: number = DEFAULT_ACK_TIMEOUT): Promise<BoolSelect<Undetermined, Record<string, unknown>, MemberReturnType<T>[K]>> {
		this.logger.debug(`\u25B2 message '${messageType}':`, message);
		return new Promise((resolve, reject) => {
			this.socket.timeout(timeout).emit(messageType, message, (response: unknown) => {
				if (response instanceof Error) {
					reject(response);
				} else if (!IsObject(response)) {
					reject(new Error(`Invalid response type: ${typeof response}`));
				} else {
					resolve(response as BoolSelect<Undetermined, Record<string, unknown>, MemberReturnType<T>[K]>);
				}
			});
		});
	}
}
