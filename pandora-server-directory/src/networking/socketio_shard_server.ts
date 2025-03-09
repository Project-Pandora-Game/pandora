import type { Server as HttpServer, IncomingMessage } from 'http';
import { GetLogger, HTTP_SOCKET_IO_SHARD_PATH, IDirectoryShard, IIncomingConnection } from 'pandora-common';
import { SocketInterfaceOneshotMessages, SocketInterfaceRequest } from 'pandora-common/dist/networking/helpers.js';
import { IServerSocket } from 'pandora-common/dist/networking/room.js';
import type { Socket } from 'socket.io';
import { ShardTokenStore } from '../shard/shardTokenStore.ts';
import { ShardConnection } from './connection_shard.ts';
import { SocketIOServer } from './socketio_common_server.ts';
import { SocketIOSocket } from './socketio_common_socket.ts';

const logger = GetLogger('SIO-Server-Shard');

/** Class housing socket.io endpoint for shards */
export class SocketIOServerShard extends SocketIOServer implements IServerSocket<IDirectoryShard> {

	constructor(httpServer: HttpServer) {
		super(httpServer, {
			// URL for shard connecting is different from for connecting client
			path: HTTP_SOCKET_IO_SHARD_PATH,
		});
	}

	/**
	 * Check incoming request and decide if it should be accepted or not
	 * @param req - The request to check
	 * @param next - Callback for accept/reject
	 */
	protected override allowRequest(req: IncomingMessage, next: (err: string | null | undefined, success: boolean) => void): void {
		if (!ShardTokenStore.allowRequest(req)) {
			next('Unauthorized: invalid secret', false);
			logger.warning(`Rejecting shard connection from ${req.socket.remoteAddress ?? '[unknown]'}: Bad secret`);
			return;
		}

		next(undefined, true);
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected override onConnect(socket: Socket): void {
		logger.debug(`New shard connected; id: ${socket.id}, remoteAddress: ${socket.request.socket.remoteAddress ?? '[unknown]'}`);
		socket.once('disconnect', () => {
			logger.debug(`Shard disconnected; id: ${socket.id}`);
		});
		const info = ShardTokenStore.getConnectInfo(socket.handshake);
		if (!info) {
			logger.warning(`Rejecting shard connection from ${socket.request.socket.remoteAddress ?? '[unknown]'}: Bad secret`);
			socket.disconnect(true);
			return;
		}
		new ShardConnection(this, new SocketIOSocket(socket), info);
	}

	public sendToAll<K extends SocketInterfaceOneshotMessages<IDirectoryShard>>(client: ReadonlySet<IIncomingConnection<IDirectoryShard>>, messageType: K, message: SocketInterfaceRequest<IDirectoryShard>[K]): void {
		const rooms = [...client].map((c) => c.id);
		this.socketServer.to(rooms).emit(messageType, message);
	}
}
