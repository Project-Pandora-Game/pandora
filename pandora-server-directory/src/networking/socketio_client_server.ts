import type { Server as HttpServer, IncomingMessage } from 'http';
import { GetLogger, HTTP_HEADER_CLIENT_REQUEST_SHARD, IDirectoryClient, IIncomingConnection } from 'pandora-common';
import { SocketInterfaceOneshotMessages, SocketInterfaceRequest } from 'pandora-common/dist/networking/helpers.js';
import { IServerSocket } from 'pandora-common/dist/networking/room.js';
import type { Socket } from 'socket.io';
import { SHARD_WAIT_STOP, ShardManager } from '../shard/shardManager.ts';
import { ClientConnection } from './connection_client.ts';
import { SocketIOServer } from './socketio_common_server.ts';
import { SocketIOSocket } from './socketio_common_socket.ts';

const logger = GetLogger('SIO-Server-Client');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerClient extends SocketIOServer implements IServerSocket<IDirectoryClient> {

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
		new ClientConnection(this, new SocketIOSocket(socket), socket.handshake.auth);
	}

	public sendToAll<K extends SocketInterfaceOneshotMessages<IDirectoryClient>>(client: ReadonlySet<IIncomingConnection<IDirectoryClient>>, messageType: K, message: SocketInterfaceRequest<IDirectoryClient>[K]): void {
		const rooms = [...client].map((c) => c.id);
		this.socketServer.to(rooms).emit(messageType, message);
	}
}
