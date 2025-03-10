import { nanoid } from 'nanoid';
import { GetLogger, Logger } from '../logging.ts';
import { AssertNotNullable } from '../utility/misc.ts';
import { IsObject } from '../validation.ts';
import { DEFAULT_ACK_TIMEOUT, MESSAGE_HANDLER_DEBUG_ALL, MESSAGE_HANDLER_DEBUG_MESSAGES } from './config.ts';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotMessages, SocketInterfaceRequest, SocketInterfaceRespondedMessages, SocketInterfaceResponse } from './helpers.ts';
import { BadMessageError, IMessageHandler } from './message_handler.ts';
import type { IServerSocket, ServerRoom } from './room.ts';
import { EmitterWithAck, IncomingSocket, MessageCallback, MockConnectionSocket } from './socket.ts';

export interface IConnectionBase<OutboundT extends SocketInterfaceDefinition> {
	/**
	 * Send a oneshot message to the client
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 */
	sendMessage<K extends SocketInterfaceOneshotMessages<OutboundT>>(messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void;

	/**
	 * Send a message to the client and wait for a response
	 * @param messageType - Type of message to send
	 * @param message - Message data
	 * @param timeout - Timeout in seconds
	 */
	awaitResponse<K extends SocketInterfaceRespondedMessages<OutboundT>>(
		messageType: K,
		message: SocketInterfaceRequest<OutboundT>[K],
		timeout?: number
	): Promise<SocketInterfaceResponse<OutboundT>[K]>;
}

export interface IIncomingConnection<OutboundT extends SocketInterfaceDefinition> extends IConnectionBase<OutboundT> {
	readonly id: string;
	/** Check if this connection is still connected */
	isConnected(): boolean;

	joinRoom(room: ServerRoom<OutboundT>): void;
	leaveRoom(room: ServerRoom<OutboundT>): void;
}

/** Allows sending messages */
export abstract class ConnectionBase<
	OutboundT extends SocketInterfaceDefinition,
	IncomingT extends SocketInterfaceDefinition,
	EmitterT extends EmitterWithAck = EmitterWithAck,
> implements IConnectionBase<OutboundT> {
	protected readonly socket: EmitterT;
	protected readonly logger: Logger;

	protected readonly schema: {
		incoming: IncomingT;
		outbound: OutboundT;
	} | null;

	constructor(
		socket: EmitterT,
		schema: [OutboundT, IncomingT] | 'DO_NOT_VALIDATE_DATA',
		logger: Logger,
	) {
		this.socket = socket;
		this.logger = logger;
		this.schema = schema === 'DO_NOT_VALIDATE_DATA' ? null : {
			outbound: schema[0],
			incoming: schema[1],
		};
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<OutboundT>>(messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void {
		// If we have schema, validate sent message
		if (this.schema) {
			if (!Object.hasOwn(this.schema.outbound, messageType) || this.schema.outbound[messageType].response !== null) {
				this.logger.error(`Attempt to send unknown message type '${messageType}', dropped.\n`, new Error());
				return;
			}

			const result = this.schema.outbound[messageType].request.safeParse(message);

			if (!result.success) {
				this.logger.error(`Attempt to send invalid message '${messageType}', dropped.\n`, new Error(), '\n', result.error.toString());
				return;
			}
			// Replace message with parsed result, as it might have stripped some data
			message = result.data;
		}
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25B2 message '${messageType}':`, message);
		}
		this.socket.emit(messageType as string, message);
	}

	public awaitResponse<K extends SocketInterfaceRespondedMessages<OutboundT>>(
		messageType: K,
		message: SocketInterfaceRequest<OutboundT>[K],
		timeout: number = DEFAULT_ACK_TIMEOUT,
	): Promise<SocketInterfaceResponse<OutboundT>[K]> {
		// If we have schema, validate sent message
		if (this.schema) {
			if (!Object.hasOwn(this.schema.outbound, messageType) || this.schema.outbound[messageType].response === null) {
				this.logger.error(`Attempt to send unknown message type '${messageType}', dropped.\n`, new Error());
				return Promise.reject(new Error('Invalid message'));
			}

			const result = this.schema.outbound[messageType].request.safeParse(message);

			if (!result.success) {
				this.logger.error(`Attempt to send invalid message '${messageType}', dropped.\n`, new Error(), '\n', result.error.toString());
				return Promise.reject(new Error('Invalid message'));
			}
			// Replace message with parsed result, as it might have stripped some data
			message = result.data;
		}
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25B2 message '${messageType}':`, message);
		}
		return new Promise((resolve, reject) => {
			this.socket.timeout(timeout).emit(messageType, message, (socketError: unknown, error: unknown, response?: unknown) => {
				if (socketError != null) {
					if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
						this.logger.warning(`\u25BC message '${messageType}' socket error:`, socketError);
					}
					return reject(socketError instanceof Error ? socketError : new Error('Socket error', { cause: socketError }));
				}
				if (error != null) {
					if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
						this.logger.warning(`\u25BC message '${messageType}' error:`, error);
					}
					if (typeof error !== 'string') {
						return reject(new Error(`Invalid error type: ${typeof error}`));
					}
					return reject(new Error(error));
				}
				if (!IsObject(response)) {
					return reject(new Error(`Invalid response type: ${typeof response}`));
				}

				// If we have schema, validate received response message
				if (this.schema) {
					const responseSchema = this.schema.outbound[messageType]?.response;
					AssertNotNullable(responseSchema);

					const result = responseSchema.safeParse(response);

					if (!result.success) {
						this.logger.warning(`Bad response content for '${messageType}'.\n`, result.error.toString(), '\n', response);
						return reject(new Error('Invalid response'));
					}
					// Replace message with parsed result, as it might have stripped some data
					response = result.data;
				}

				if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
					this.logger.debug(`\u25BC message '${messageType}' response:`, response);
				}
				resolve(response as SocketInterfaceResponse<OutboundT>[K]);
			});
		});
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @param callback - Callback to respond, if this message is expecting response
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected abstract onMessage<K extends (keyof IncomingT & string)>(
		messageType: K,
		message: SocketInterfaceRequest<IncomingT>[K],
	): Promise<SocketInterfaceResponse<IncomingT>[K]>;

	protected handleMessage(messageType: unknown, message: unknown, callback: MessageCallback | undefined): void {
		if (typeof messageType !== 'string') {
			this.logger.warning(`Invalid messageType: ${typeof messageType}`);
			return;
		}
		if (callback !== undefined && typeof callback !== 'function') {
			this.logger.warning(`Message '${messageType}' callback is not a function: ${typeof callback}`);
			return;
		}
		if (!IsObject(message)) {
			this.logger.warning(`Invalid message type: ${typeof message}`);
			return;
		}

		// If we have schema, validate received message
		if (this.schema) {
			const messageSchema = this.schema.incoming[messageType];
			if (messageSchema == null) {
				this.logger.warning(`Invalid message type: '${messageType}'`);
				callback?.('Unknown request');
				return;
			}

			if ((messageSchema.response == null) !== (callback == null)) {
				this.logger.warning(`Received message '${messageType}' ${callback != null ? 'has' : `doesn't have`} callback, but expected ${messageSchema.response != null ? 'one' : 'none'}`);
				callback?.('Request does not expect callback');
				return;
			}

			const result = messageSchema.request.safeParse(message);

			if (!result.success) {
				this.logger.warning(`Bad message content for '${messageType}'.\n`, result.error.toString(), '\n', message);
				callback?.('Bad message content');
				return;
			}
			// Replace message with parsed result, as it might have stripped some data
			message = result.data;
		}

		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25BC message '${messageType}'${callback ? ' with callback' : ''}`, message);
			if (callback) {
				const outerCallback = callback;
				callback = (cbError: null | string, cbResult?: Record<string, unknown>) => {
					if (cbError != null) {
						this.logger.debug(`\u25B2 message '${messageType}' response error:`, cbError);
						return outerCallback(cbError);
					}
					AssertNotNullable(cbResult);

					this.logger.debug(`\u25B2 message '${messageType}' result:`, cbResult);
					outerCallback(cbError, cbResult);
				};
			}
		}

		// If we have schema, validate sent response
		if (callback && this.schema) {
			const outerCallback = callback;
			callback = (cbError: null | string, cbResult?: Record<string, unknown>) => {
				if (cbError != null) {
					return outerCallback(cbError);
				}
				AssertNotNullable(cbResult);

				const responseSchema = this.schema?.incoming[messageType]?.response;
				AssertNotNullable(responseSchema);

				const result = responseSchema.safeParse(cbResult);

				if (!result.success) {
					this.logger.error(`Attempt to send bad response for '${messageType}', dropped.\n`, new Error(), '\n', result.error.toString());
					return outerCallback('Bad response');
				}
				// Replace message with parsed result, as it might have stripped some data
				outerCallback(null, result.data);
			};
		}

		this.onMessage(
			messageType as (keyof IncomingT & string),
			message as SocketInterfaceRequest<IncomingT>[keyof IncomingT & string],
		)
			.then((result) => {
				if (IsObject(result)) {
					if (callback) {
						callback(null, result);
					} else {
						this.logger.error(`Message '${messageType}' has result, but missing callback`);
					}
				} else if (result !== undefined) {
					this.logger.error(`Message '${messageType}' has invalid result type: ${typeof result}\n`, result);
					callback?.('Bad response');
				} else if (callback) {
					this.logger.error(`Message '${messageType}' no result, but expected one`);
					callback?.('Bad response');
				}
			})
			.catch((error) => {
				if (error === false) {
					callback?.('Rejected');
					return;
				}

				if (error instanceof BadMessageError) {
					error.log(this.logger, messageType, message);
					callback?.('Bad message');
				} else {
					this.logger.error('Error processing message:', error, `\nMessage type: '${messageType}', message:`, message);
					callback?.('Error processing message');
				}
			});
	}
}

/** Allows sending and receiving messages */
export abstract class IncomingConnection<
	OutboundT extends SocketInterfaceDefinition,
	IncomingT extends SocketInterfaceDefinition,
	SocketT extends IncomingSocket = IncomingSocket,
> extends ConnectionBase<OutboundT, IncomingT, SocketT> implements IIncomingConnection<OutboundT> {
	private _rooms: Set<ServerRoom<OutboundT>> = new Set();
	private _server: IServerSocket<OutboundT>;

	constructor(
		server: IServerSocket<OutboundT>,
		socket: SocketT,
		schema: [OutboundT, IncomingT] | 'DO_NOT_VALIDATE_DATA',
		logger: Logger,
	) {
		super(socket, schema, logger);
		this._server = server;
		socket.onDisconnect = (reason) => this.onDisconnect(reason);
		socket.onMessage = (...args) => this.handleMessage(...args);
	}

	public get id(): string {
		return this.socket.id;
	}

	public get rooms(): ReadonlySet<ServerRoom<OutboundT>> {
		return this._rooms;
	}

	/** Check if this connection is still connected */
	public isConnected(): boolean {
		return this.socket.isConnected();
	}

	/** Handler for when client disconnects */
	protected onDisconnect(_reason: string): void {
		[...this._rooms].forEach((room) => room.leave(this));
	}

	public joinRoom(room: ServerRoom<OutboundT>): void {
		room.join(this._server, this);
		this._rooms.add(room);
	}

	public leaveRoom(room: ServerRoom<OutboundT>): void {
		room.leave(this);
	}
}

export class MockServerSocket<T extends SocketInterfaceDefinition> implements IServerSocket<T> {
	public sendToAll<K extends SocketInterfaceOneshotMessages<T>>(clients: ReadonlySet<IConnectionBase<T>>, messageType: K, message: SocketInterfaceRequest<T>[K]): void {
		for (const client of clients) {
			client.sendMessage(messageType, message);
		}
	}
}

export class MockConnection<
	OutboundT extends SocketInterfaceDefinition,
	IncomingT extends SocketInterfaceDefinition,
> extends ConnectionBase<OutboundT, IncomingT, MockConnectionSocket> {
	public readonly messageHandler: IMessageHandler<IncomingT, MockConnection<OutboundT, IncomingT>>;

	public get id(): string {
		return this.socket.id;
	}

	constructor(
		messageHandler: IMessageHandler<IncomingT, MockConnection<OutboundT, IncomingT>>,
		id: string = nanoid(),
		logger?: Logger,
	) {
		super(new MockConnectionSocket(id), 'DO_NOT_VALIDATE_DATA', logger ?? GetLogger('MockConnection', `[MockConnection, ${id}]`));
		this.messageHandler = messageHandler;
		this.socket.onMessage = this.handleMessage.bind(this);
	}

	protected onMessage<K extends (keyof IncomingT & string)>(
		messageType: K,
		message: SocketInterfaceRequest<IncomingT>[K],
	): Promise<SocketInterfaceResponse<IncomingT>[K]> {
		return this.messageHandler.onMessage(
			messageType,
			message,
			this,
		);
	}

	/** Check if this connection is still connected */
	public isConnected(): boolean {
		return this.socket.isConnected();
	}

	public connect(): IncomingSocket {
		return this.socket.remote;
	}

	public disconnect(): void {
		this.socket.disconnect();
	}
}
