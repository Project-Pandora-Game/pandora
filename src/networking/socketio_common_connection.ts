import type { Socket } from 'socket.io';
import type { ConnectionType, IConnection } from './common';

/** Class housing any incoming connection */
export abstract class SocketIOConnection implements IConnection {

	abstract readonly type: ConnectionType;

	/** The socket for this connection */
	protected readonly socket: Socket;

	constructor(socket: Socket) {
		this.socket = socket;
	}

	/** Check if this connection is still connected */
	isConnected(): boolean {
		return this.socket.connected;
	}
}
