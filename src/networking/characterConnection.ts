import type { Socket } from 'socket.io';

/** Class housing connection from a client/character */
export class CharacterConnection {

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
