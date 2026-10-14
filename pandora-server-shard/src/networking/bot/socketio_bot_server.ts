import type { Server as HttpServer } from 'http';
import { Assert, GetLogger, HTTP_SOCKET_IO_BOT_PATH, IIncomingConnection, type IServerSocket, type SpaceId } from 'pandora-common';
import type { BotId } from 'pandora-common/bots';
import { BotShardSocketAuthMessageSchema, type IShardBot } from 'pandora-common/networking/api/shard_bot';
import type { SocketInterfaceOneshotMessages, SocketInterfaceRequest } from 'pandora-common/networking/helpers';
import type { DefaultEventsMap, ExtendedError, Socket } from 'socket.io';
import * as z from 'zod';
import { SpaceManager } from '../../spaces/spaceManager.ts';
import { SocketIOServer } from '../socketio_common_server.ts';
import { SocketIOSocket } from '../socketio_common_socket.ts';
import { BotConnection } from './connection_bot.ts';

const logger = GetLogger('SIO-Server-Bot');

type ConnectData = { bot: BotId; space: SpaceId; secret: string; };

/** Class housing socket.io endpoint for clients */
export class SocketIOServerBot extends SocketIOServer<ConnectData> implements IServerSocket<IShardBot> {

	constructor(httpServer: HttpServer) {
		super(httpServer, {
			// URL for shard connecting is different from for connecting client
			path: '/' + HTTP_SOCKET_IO_BOT_PATH,
		});
		this.socketServer.use((socket, next) => {
			// Read token from the auth
			try {
				next(((): ExtendedError | undefined => {
					const parsedAuth = BotShardSocketAuthMessageSchema.safeParse(socket.handshake.auth);
					if (!parsedAuth.success) {
						logger.verbose('Rejecting connection due to invalid auth:\n', z.prettifyError(parsedAuth.error));
						return new Error('Failed to parse auth message');
					}

					if (parsedAuth.data.version !== 1) {
						logger.verbose('Rejecting connection due to invalid version:', parsedAuth.data.version);
						return new Error('Invalid version, expected 1');
					}

					const space = SpaceManager.getSpace(parsedAuth.data.space);
					if (space == null || space.bot == null || space.bot.id !== parsedAuth.data.bot || space.bot.state.connectSecret !== parsedAuth.data.secret) {
						logger.verbose('Rejecting connection due to invalid auth');
						return new Error('Invalid auth');
					}

					socket.data.bot = parsedAuth.data.bot;
					socket.data.space = parsedAuth.data.space;
					socket.data.secret = parsedAuth.data.secret;
					return undefined;
				})());
			} catch (err) {
				logger.error('Error processing Bot handshake: ', err);
				next(new Error('Error processing handshake'));
			}
		});
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected override onConnect(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Partial<ConnectData>>): void {
		logger.debug(`New Bot client connected; id: ${socket.id}, remoteAddress: ${socket.request.socket.remoteAddress ?? '[unknown]'}`);
		socket.once('disconnect', () => {
			logger.debug(`Bot client disconnected; id: ${socket.id}`);
		});

		const { bot, space: spaceId, secret } = socket.data;
		Assert(bot != null && spaceId != null && secret != null, 'Connection data missing after successful connection'); // Shouldn't happen after auth middleware runs

		const space = SpaceManager.getSpace(spaceId);
		// Should be hot after auth middleware, but not guaranteed due to races (e.g. token deletion)
		if (space == null || space.bot == null || space.bot.id !== bot || space.bot.state.connectSecret !== secret) {
			logger.warning(`Late rejecting Bot connection from ${socket.request.socket.remoteAddress ?? '[unknown]'}: Bad token`);
			socket.disconnect(true);
			return;
		}
		new BotConnection(this, new SocketIOSocket(socket), space.bot, secret);
	}

	public sendToAll<K extends SocketInterfaceOneshotMessages<IShardBot>>(client: ReadonlySet<IIncomingConnection<IShardBot>>, messageType: K, message: SocketInterfaceRequest<IShardBot>[K]): void {
		const rooms = [...client].map((c) => c.id);
		this.socketServer.to(rooms).emit(messageType, message);
	}
}
