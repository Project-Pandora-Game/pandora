import { IDirectoryClient, GetLogger, IncomingSocket, IServerSocket, ClientDirectorySchema, IClientDirectory, IncomingConnection, DirectoryClientSchema, Assert, IDirectoryClientArgument } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import type { Account } from '../account/account';
import type { Character } from '../account/character';
import { ConnectionManagerClient } from './manager_client';

/** Class housing connection from a client */
export class ClientConnection extends IncomingConnection<IDirectoryClient, IClientDirectory, IncomingSocket> {
	/** The current account this connection is logged in as or `null` if it isn't */
	private _account: Account | null = null;
	public get account(): Account | null {
		return this._account;
	}

	/** The current character this connection is using or `null` if none */
	private _character: Character | null = null;
	public get character(): Character | null {
		return this._character;
	}

	public isLoggedIn(): this is { readonly account: Account; } {
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
		super.onDisconnect(reason);
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected onMessage<K extends keyof IClientDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IClientDirectory>[K],
	): Promise<SocketInterfaceResponse<IClientDirectory>[K]> {
		return ConnectionManagerClient.onMessage(messageType, message, this);
	}

	/**
	 * Set or clear the account this connection is logged in as
	 * @param account - The account to set or `null` to clear
	 */
	public setAccount(account: Account | null): void {
		if (this._account === account)
			return;
		if (this._account) {
			Assert(this.rooms.has(this._account.associatedConnections));
			this.setCharacter(null);
			this._account.touch();
			this.leaveRoom(this._account.associatedConnections);
			this._account = null;
		}
		if (account) {
			account.touch();
			this._account = account;
			this.joinRoom(account.associatedConnections);
		}
	}

	/**
	 * Set or clear the character this connection is using
	 * @param character - The character to set or `null` to clear
	 */
	public setCharacter(character: Character | null): void {
		if (this._character === character)
			return;
		if (this._character) {
			Assert(this._character.assignedConnection === this);
			this._character.assignedConnection = null;
			this._character = null;
		}
		if (character) {
			Assert(this._account === character.account);
			Assert(character.assignedConnection == null);
			this._character = character;
			character.assignedConnection = this;
		}
	}

	public override awaitResponse(_messageType: unknown, _message: unknown, _timeout?: unknown): Promise<never> {
		throw new Error('Invalid operation');
	}

	public sendConnectionStateUpdate(withRelationships: boolean = false): void {
		const response: IDirectoryClientArgument['connectionState'] = {
			account: this.account ? this.account.getAccountInfo() : null,
			character: this.character ? this.character.getShardConnectionInfo() : null,
		};
		if (withRelationships && this.account) {
			Promise
				.all([
					this.account.relationship.getAll(),
					this.account.relationship.getAllStatus(),
				])
				.then(([relationships, friends]) => {
					response.relationships = {
						relationships,
						friends,
					};
					this.sendMessage('connectionState', response);
				})
				.catch((e) => {
					this.logger.warning(`Failed to get relationships for account`, e);
				});
		} else {
			this.sendMessage('connectionState', response);
		}
	}
}
