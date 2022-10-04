import { IDirectoryClient, GetLogger, IncomingSocket, IServerSocket, ClientDirectorySchema, IClientDirectory, IncomingConnection, DirectoryClientSchema } from 'pandora-common';
import { SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import type { Account } from '../account/account';
import type { Character } from '../account/character';
import { ConnectionType, IConnectionClient } from './common';
import { ConnectionManagerClient } from './manager_client';

/** Class housing connection from a client */
export class ClientConnection extends IncomingConnection<IDirectoryClient, IClientDirectory, IncomingSocket> implements IConnectionClient {
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

	isLoggedIn(): this is { readonly account: Account; } {
		return this.account !== null;
	}

	constructor(server: IServerSocket<IDirectoryClient>, socket: IncomingSocket, auth: unknown) {
		super(server, socket, [DirectoryClientSchema, ClientDirectorySchema], GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		this.logger.debug('Connected');
		ConnectionManagerClient.onConnect(this, auth);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(reason: string): void {
		this.logger.debug('Disconnected, reason:', reason);
		ConnectionManagerClient.onDisconnect(this);
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected onMessage<K extends (keyof IClientDirectory & string)>(
		messageType: K,
		message: Record<string, unknown>,
		callback?: ((arg: SocketInterfaceResponse<IClientDirectory>[K]) => void) | undefined,
	): Promise<boolean> {
		return ConnectionManagerClient.onMessage(messageType, message, callback as ((arg: Record<string, unknown>) => void), this);
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
			const otherCharacter = character.assignedConnection;
			if (otherCharacter && otherCharacter !== this) {
				otherCharacter.setCharacter(null);
				otherCharacter.sendConnectionStateUpdate();
			}
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
			character: this.character ? this.character.getShardConnectionInfo() : null,
		});
	}
}
