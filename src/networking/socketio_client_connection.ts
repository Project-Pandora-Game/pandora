import type { IncomingHttpHeaders } from 'http';
import { CharacterId, GetLogger, IShardClientBase } from 'pandora-common';
import type { Socket } from 'socket.io';
import Character from '../character/character';
import { CharacterManager } from '../character/characterManager';
import { ConnectionType, IConnectionClient } from './common';
import { ConnectionManagerClient } from './manager_client';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a client */
export class SocketIOConnectionClient extends SocketIOConnection<IShardClientBase> implements IConnectionClient {
	readonly type: ConnectionType.CLIENT = ConnectionType.CLIENT;

	public get id(): string {
		return this.socket.id;
	}

	private _aborted: boolean = false;
	public get aborted(): boolean {
		return this._aborted;
	}

	private _character: Character | undefined;
	public get character(): Character {
		return this._character as Character;
	}

	public get headers(): IncomingHttpHeaders {
		return this.socket.handshake.headers;
	}

	constructor(socket: Socket) {
		super(socket, GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		ConnectionManagerClient.onConnect(this);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(_reason: string): void {
		ConnectionManagerClient.onDisconnect(this);
	}

	public abortConnection(): void {
		this._aborted = true;
		if (this._character?.connection === this) {
			this._character.connection = undefined;
			this._character = undefined;
		}
		this.socket.disconnect(true);
	}

	public loadCharacter(id: CharacterId): boolean {
		this._character = CharacterManager.getCharacter(id) as Character;
		if (!this._character) {
			this.logger.error(`Character ${id} not found`);
			this.abortConnection();
			return false;
		}
		this._character.connection = this;
		return true;
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerClient.messageHandler.onMessage(messageType, message, callback, this);
	}
}
