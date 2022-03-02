import { ConnectionBase, Logger, CreateMessageHandlerOnAny } from 'pandora-common';
import type { SocketInterfaceDefinition } from 'pandora-common/dist/networking/helpers';
import type { Socket } from 'socket.io';
import type { ConnectionType } from './common';

export interface ISocketIOConnection {
	readonly type: ConnectionType;
	isConnected(): boolean;
}

/** Class housing any incoming connection */
export abstract class SocketIOConnection<T extends SocketInterfaceDefinition<T>> extends ConnectionBase<Socket, T> implements ISocketIOConnection {

	abstract readonly type: ConnectionType;

	protected constructor(socket: Socket, logger: Logger) {
		super(socket, logger);
		this.socket.on('disconnect', (reason) => {
			this.logger.verbose('Disconnected, reason:', reason);
			this.onDisconnect(reason);
		});
		this.socket.onAny(CreateMessageHandlerOnAny(logger, (messageType, message, callback) => this.onMessage(messageType, message, callback)));
		this.logger.verbose('Connected');
	}

	/** Check if this connection is still connected */
	isConnected(): boolean {
		return this.socket.connected;
	}

	/** Handler for when client disconnects */
	protected abstract onDisconnect(reason: string): void;

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected abstract onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean>;
}
