import type { Socket } from 'socket.io';
import type { IncomingMessage, Server as HttpServer } from 'http';
import { GetLogger, HTTP_HEADER_CLIENT_REQUEST_SHARD } from 'pandora-common';
import { SocketIOServer } from './socketio_common_server';
import { ClientConnection } from './connection_client';
import { SocketIOSocket } from './socketio_common_socket';
import { ShardManager, SHARD_WAIT_STOP } from '../shard/shardManager';

const logger = GetLogger('SIO-Server-Client');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerClient extends SocketIOServer {

	constructor(httpServer: HttpServer) {
		super(httpServer, {});
	}

	/**
	 * Check incoming request and decide if it should be accepted or not
	 * @param req - The request to check
	 * @param next - Callback for accept/reject
	 */
	protected override allowRequest(req: IncomingMessage, next: (err: string | null | undefined, success: boolean) => void): void {
		// If there is secret set, it must be verified
		const requestedShard = req.headers[HTTP_HEADER_CLIENT_REQUEST_SHARD.toLowerCase()];
		if (
			typeof requestedShard === 'string' &&
			SHARD_WAIT_STOP > Date.now() &&
			ShardManager.getShard(requestedShard) == null
		) {
			next('Waiting for shard', false);
			logger.debug('Wait for shard', requestedShard);
			return;
		}
		next(undefined, true);
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
