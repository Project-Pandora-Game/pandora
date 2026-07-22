import type { Server as HttpServer } from 'http';
import { Assert, GetLogger, HTTP_SOCKET_IO_API_PATH, IIncomingConnection, type IServerSocket, type PandoraAccessToken } from 'pandora-common';
import { ApiDirectorySocketAuthMessageSchema, type IDirectoryApi } from 'pandora-common/networking/api/directory_api';
import { SocketInterfaceOneshotMessages, SocketInterfaceRequest } from 'pandora-common/networking/helpers';
import type { DefaultEventsMap, ExtendedError, Socket } from 'socket.io';
import * as z from 'zod';
import { accountManager } from '../../../account/accountManager.ts';
import { SocketIOServer } from '../../socketio_common_server.ts';
import { ApiConnection } from './connection_api.ts';
import { SocketIOSocket } from '../../socketio_common_socket.ts';

const logger = GetLogger('SIO-Server-Api');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerApi extends SocketIOServer<{ token: PandoraAccessToken; }> implements IServerSocket<IDirectoryApi> {

	constructor(httpServer: HttpServer) {
		super(httpServer, {
			// URL for shard connecting is different from for connecting client
			path: '/' + HTTP_SOCKET_IO_API_PATH,
		});
		this.socketServer.use((socket, next) => {
			// Read token from the auth
			(async (): Promise<ExtendedError | undefined> => {
				const parsedAuth = ApiDirectorySocketAuthMessageSchema.safeParse(socket.handshake.auth);
				if (!parsedAuth.success) {
					logger.verbose('Rejecting connection due to invalid auth:\n', z.prettifyError(parsedAuth.error));
					return new Error('Failed to parse auth message');
				}

				if (parsedAuth.data.version !== 1) {
					logger.verbose('Rejecting connection due to invalid version:', parsedAuth.data.version);
					return new Error('Invalid version, expected 1');
				}

				const account = await accountManager.loadAccountByAccessToken(parsedAuth.data.token);
				if (account == null) {
					logger.verbose('Rejecting connection due to invalid token');
					return new Error('Invalid token');
				}

				socket.data.token = parsedAuth.data.token;
				return undefined;
			})().then(next, (err) => {
				logger.error('Error processing API handshake: ', err);
				next(new Error('Error processing handshake'));
			});
		});
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected override onConnect(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Partial<{ token: PandoraAccessToken; }>>): void {
		logger.debug(`New API client connected; id: ${socket.id}, remoteAddress: ${socket.request.socket.remoteAddress ?? '[unknown]'}`);
		socket.once('disconnect', () => {
			logger.debug(`API Client disconnected; id: ${socket.id}`);
		});

		const token = socket.data.token;
		Assert(token != null, 'Token is null after successful connection'); // Shouldn't happen after auth middleware runs

		const account = accountManager.getAccountByAccessToken(token); // Should be hot after auth middleware, but not guaranteed due to races (e.g. token deletion)
		const tokenInfo = account?.secure.accessTokens.getTokenInfo(token);
		if (!account || !tokenInfo) {
			logger.warning(`Late rejecting API connection from ${socket.request.socket.remoteAddress ?? '[unknown]'}: Bad token`);
			socket.disconnect(true);
			return;
		}
		new ApiConnection(this, new SocketIOSocket(socket), account, token, tokenInfo);
	}

	public sendToAll<K extends SocketInterfaceOneshotMessages<IDirectoryApi>>(client: ReadonlySet<IIncomingConnection<IDirectoryApi>>, messageType: K, message: SocketInterfaceRequest<IDirectoryApi>[K]): void {
		const rooms = [...client].map((c) => c.id);
		this.socketServer.to(rooms).emit(messageType, message);
	}
}
