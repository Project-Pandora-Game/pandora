import { IDirectoryClientBase, GetLogger, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import type { Socket } from 'socket.io';
import type { Account } from '../account/account';
import type { Character } from '../account/character';
import { ConnectionType, IConnectionClient } from './common';
import { ConnectionManagerClient } from './manager_client';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a client */
export class SocketIOConnectionClient extends SocketIOConnection<IDirectoryClientBase> implements IConnectionClient {
	readonly type: ConnectionType.CLIENT = ConnectionType.CLIENT;

	/** The current account this connection is logged in as or `null` if it isn't */
	private _account: Account | null = null;
	get account(): Account | null {
		return this._account;
	}

	/** The current character this connection is using or `null` if none */
	private _character: Character | null = null;
	get character(): Character | null {
		return this._character;
	}

	get id(): string {
		return this.socket.id;
	}

	isLoggedIn(): this is { readonly account: Account; } {
		return this.account !== null;
	}

	constructor(socket: Socket) {
		super(socket, GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		ConnectionManagerClient.onConnect(this, socket.handshake.auth);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(_reason: string): void {
		ConnectionManagerClient.onDisconnect(this);
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

	/**
	 * Set or clear the account this connection is logged in as
	 * @param account - The account to set or `null` to clear
	 */
	public setAccount(account: Account | null): void {
		if (this._account) {
			this._account.associatedConnections.delete(this);
			this._account.touch();
		}
		this._account = account;
		if (account) {
			account.associatedConnections.add(this);
			account.touch();
		}
	}

	/**
	 * Set or clear the character this connection is using
	 * @param character - The character to set or `null` to clear
	 */
	public setCharacter(character: Character | null): void {
		if (this._character?.assignedConnection === this) {
			this._character.assignedConnection = null;
			this._character.account.touch();
		}
		this._character = character;
		if (character) {
			character.assignedConnection?.setCharacter(null);
			character.assignedConnection = this;
			character.account.touch();
		}
	}

	public override awaitResponse(_messageType: unknown, _message: unknown, _timeout?: unknown): Promise<never> {
		throw new Error('Invalid operation');
	}

	public sendConnectionStateUpdate(): void {
		this.sendMessage('connectionState', {
			account: this.account ? this.account.getAccountInfo() : null,
			character: this.character ? GetCharacterConnectionInfo(this.character) : null,
		});
	}
}

/** Build shard part of `connectionState` update message for connection */
function GetCharacterConnectionInfo(character: Character): IDirectoryCharacterConnectionInfo | null {
	const shard = character.assignedShard;
	if (!shard)
		return null;
	return {
		...shard.getInfo(),
		characterId: character.id,
		secret: character.connectSecret,
	};
}
