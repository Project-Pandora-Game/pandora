import { IsObject } from '../validation';
import { DEFAULT_ACK_TIMEOUT } from './config';
import { GetLogger, Logger } from '../logging';
import type { BoolSelect, MembersFirstArg } from '../utility';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotHandler, SocketInterfaceResponseHandler } from './helpers';
import type { IServerSocket, ServerRoom } from './room';
import { MESSAGE_HANDLER_DEBUG_ALL, MESSAGE_HANDLER_DEBUG_MESSAGES } from './config';
import { EmitterWithAck, IncomingSocket, MockConnectionSocket } from './socket';
import { CreateMessageHandlerOnAny, IMessageHandler } from './message_handler';

export interface IConnectionSenderBase<T extends SocketInterfaceDefinition<T>> {
	/**
	 * Send a oneshot message to the client
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 */
	sendMessage<K extends keyof SocketInterfaceOneshotHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K]): void;
}

export interface IConnectionBase<T extends SocketInterfaceDefinition<T>, Undetermined extends boolean> extends IConnectionSenderBase<T> {
	/**
	 * Send a message to the client and wait for a response
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 * @param timeout - Timeout in seconds
	 */
	awaitResponse<K extends keyof SocketInterfaceResponseHandler<T> & string>(
		messageType: K,
		message: MembersFirstArg<T>[K],
		timeout?: number
	): Promise<BoolSelect<Undetermined, Partial<Record<keyof ReturnType<T[K]>, unknown>>, ReturnType<T[K]>>>;
}

export interface IConnectionSender<T extends SocketInterfaceDefinition<T>> extends IConnectionSenderBase<T> {
	readonly id: string;
	/** Check if this connection is still connected */
	isConnected(): boolean;

	joinRoom(room: ServerRoom<T>): void;
	leaveRoom(room: ServerRoom<T>): void;
}

export interface IConnection<T extends SocketInterfaceDefinition<T>, Undetermined extends boolean> extends IConnectionBase<T, Undetermined>, IConnectionSender<T> {
}

/** Allows sending messages */
export class ConnectionBase<EmitterT extends EmitterWithAck, T extends SocketInterfaceDefinition<T>, Undetermined extends boolean = false> implements IConnectionBase<T, Undetermined> {
	protected readonly socket: EmitterT;
	protected readonly logger: Logger;

	constructor(socket: EmitterT, logger: Logger) {
		this.socket = socket;
		this.logger = logger;
	}

	sendMessage<K extends keyof SocketInterfaceOneshotHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K]): void {
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25B2 message '${messageType}':`, message);
		}
		this.socket.emit(messageType as string, message);
	}

	awaitResponse<K extends keyof SocketInterfaceResponseHandler<T> & string>(
		messageType: K,
		message: MembersFirstArg<T>[K],
		timeout: number = DEFAULT_ACK_TIMEOUT,
	): Promise<BoolSelect<Undetermined, Partial<Record<keyof ReturnType<T[K]>, unknown>>, ReturnType<T[K]>>> {
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25B2 message '${messageType}':`, message);
		}
		return new Promise((resolve, reject) => {
			this.socket.timeout(timeout).emit(messageType, message, (error: unknown, response: unknown) => {
				if (error != null) {
					if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
						this.logger.warning(`\u25BC message '${messageType}' error:`, error);
					}
					reject(error);
				} else if (!IsObject(response)) {
					reject(new Error(`Invalid response type: ${typeof response}`));
				} else {
					if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
						this.logger.debug(`\u25BC message '${messageType}' response:`, response);
					}
					resolve(response as BoolSelect<Undetermined, Partial<Record<keyof ReturnType<T[K]>, unknown>>, ReturnType<T[K]>>);
				}
			});
		});
	}
}

/** Allows sending and receiving messages */
export abstract class Connection<EmitterT extends IncomingSocket, T extends SocketInterfaceDefinition<T>, Undetermined extends boolean = false> extends ConnectionBase<EmitterT, T, Undetermined> implements IConnection<T, Undetermined> {
	private _rooms: Set<ServerRoom<T>> = new Set();
	private _server: IServerSocket<T>;

	constructor(server: IServerSocket<T>, socket: EmitterT, logger: Logger) {
		super(socket, logger);
		this._server = server;
		socket.onDisconnect = this.onDisconnect.bind(this);
		socket.onMessage = CreateMessageHandlerOnAny(logger, (messageType, message, callback) => this.onMessage(messageType, message, callback));
	}

	get id(): string {
		return this.socket.id;
	}

	get rooms(): ReadonlySet<ServerRoom<T>> {
		return this._rooms;
	}

	/** Check if this connection is still connected */
	isConnected(): boolean {
		return this.socket.isConnected();
	}

	/** Handler for when client disconnects */
	protected onDisconnect(_reason: string): void {
		[...this._rooms].forEach((room) => room.leave(this));
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected abstract onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean>;

	public joinRoom(room: ServerRoom<T>): void {
		room.join(this._server, this);
		this._rooms.add(room);
	}

	public leaveRoom(room: ServerRoom<T>): void {
		room.leave(this);
	}
}

export class MockServerSocket<T extends SocketInterfaceDefinition<T>> implements IServerSocket<T> {
	sendToAll<K extends keyof SocketInterfaceOneshotHandler<T> & string>(clients: ReadonlySet<IConnectionSender<T>>, messageType: K, message: MembersFirstArg<T>[K]): void {
		for (const client of clients) {
			client.sendMessage(messageType, message);
		}
	}
}

export class MockConnection<T extends SocketInterfaceDefinition<T>> extends Connection<MockConnectionSocket, T, false> {
	readonly messageHandler: IMessageHandler<MockConnection<T>>;

	constructor(server: IServerSocket<T>, messageHandler: IMessageHandler<MockConnection<T>>, id: string, logger?: Logger) {
		super(server, new MockConnectionSocket(id), logger ?? GetLogger('MockConnection', `[MockConnection, ${id}]`));
		this.messageHandler = messageHandler;
	}

	onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return this.messageHandler.onMessage(messageType, message, callback, this);
	}

	connect(): IncomingSocket {
		return this.socket.remote;
	}

	disconnect(): void {
		this.socket.disconnect();
	}
}
