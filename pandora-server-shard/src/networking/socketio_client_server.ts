import type { Server as HttpServer, IncomingMessage } from 'http';
import { GetLogger, IIncomingConnection, IsCharacterId, IServerSocket, IShardClient } from 'pandora-common';
import type { SocketInterfaceOneshotMessages, SocketInterfaceRequest } from 'pandora-common/dist/networking/helpers.js';
import type { Socket } from 'socket.io';
import { CharacterManager } from '../character/characterManager.ts';
import { ClientConnection } from './connection_client.ts';
import { ConnectionManagerClient } from './manager_client.ts';
import { SocketIOServer } from './socketio_common_server.ts';
import { SocketIOSocket } from './socketio_common_socket.ts';

const logger = GetLogger('SIO-Server-Client');

/** Class housing socket.io endpoint for clients */
export class SocketIOServerClient extends SocketIOServer implements IServerSocket<IShardClient> {

	constructor(httpServer: HttpServer) {
		super(httpServer, {});
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected onConnect(socket: Socket): void {
		new ClientConnection(this, new SocketIOSocket(socket), socket.handshake.headers);
	}

	protected override allowRequest(req: IncomingMessage, next: (err: string | null | undefined, success: boolean) => void): void {
		const [characterId, secret] = (req.headers.authorization || '').split(' ');
		if (!IsCharacterId(characterId) || !secret || !ConnectionManagerClient.isAuthorized(characterId, secret)) {
			const character = IsCharacterId(characterId) ? CharacterManager.getCharacter(characterId) : null;

			logger.debug(`Rejecting connection request for character '${characterId}':`,
				!IsCharacterId(characterId) ? 'Invalid character id' :
					!secret ? 'No secret provided' :
						(character == null) ? 'Character not loaded' :
							!character.isValid ? 'Character is in invalid state' :
								'Unauthorized secret',
			);

			next('Invalid authorization header', false);
			return;
		}
		next(undefined, true);
	}

	public sendToAll<K extends SocketInterfaceOneshotMessages<IShardClient>>(client: ReadonlySet<IIncomingConnection<IShardClient>>, messageType: K, message: SocketInterfaceRequest<IShardClient>[K]): void {
		const rooms = [...client].map((c) => c.id);
		this.socketServer.to(rooms).emit(messageType, message);
	}
}
