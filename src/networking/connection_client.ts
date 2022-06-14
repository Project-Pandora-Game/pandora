import { CharacterId, GetLogger, IShardClientBase, Connection, IncomingSocket, IServerSocket } from 'pandora-common';
import { Character } from '../character/character';
import { CharacterManager } from '../character/characterManager';
import { ConnectionType, IConnectionClient } from './common';
import { ConnectionManagerClient } from './manager_client';

/** Class housing connection from a client */
export class ClientConnection extends Connection<IncomingSocket, IShardClientBase, true> implements IConnectionClient {
	readonly type: ConnectionType.CLIENT = ConnectionType.CLIENT;

	private _aborted: boolean = false;
	public get aborted(): boolean {
		return this._aborted;
	}

	/** Character of the connection, always set by `Character` class */
	public character: Character | null = null;

	public readonly headers: Record<string, undefined | string | string[]>;

	constructor(server: IServerSocket<IShardClientBase>, socket: IncomingSocket, headers: Record<string, undefined | string | string[]>) {
		super(server, socket, GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		this.headers = headers;
		this.logger.verbose('Connected');
		ConnectionManagerClient.onConnect(this);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(reason: string): void {
		this.character?.setConnection(null);
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerClient.onDisconnect(this);
	}

	public abortConnection(): void {
		if (this._aborted)
			return;
		this._aborted = true;
		this.character?.setConnection(null);
		this.socket.disconnect();
	}

	public loadCharacter(id: CharacterId): boolean {
		const character = CharacterManager.getCharacter(id);
		if (!character) {
			this.logger.error(`Character ${id} not found`);
			this.abortConnection();
			return false;
		}
		character.setConnection(this);
		return true;
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerClient.onMessage(messageType, message, callback, this);
	}
}
