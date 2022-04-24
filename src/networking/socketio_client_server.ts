import type { Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { GetLogger } from 'pandora-common';
import { SocketIOServer } from './socketio_common_server';
import { ClientConnection } from './connection_client';
import { SocketIOSocket } from './socketio_common_socket';

const logger = GetLogger('SIO-Server-Client');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerClient extends SocketIOServer {

	constructor(httpServer: HttpServer) {
		super(httpServer, {});
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected onConnect(socket: Socket): void {
		const connection = new ClientConnection(new SocketIOSocket(socket), socket.handshake.auth);
		if (!connection.isConnected()) {
			logger.fatal('Asserting failed: client disconnect before onConnect finished');
		}
	}
}
