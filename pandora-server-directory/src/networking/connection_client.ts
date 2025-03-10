import { Assert, ClientDirectorySchema, DirectoryClientSchema, GetLogger, IClientDirectory, IDirectoryClient, IncomingConnection, IncomingSocket, IServerSocket, type TypedEventEmitterEvents } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers.js';
import type { Account } from '../account/account.ts';
import { AccountToken, AccountTokenReason } from '../account/accountSecure.ts';
import type { Character } from '../account/character.ts';
import { ConnectionManagerClient } from './manager_client.ts';

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

	private _loginTokenEventUnsubscribe: (() => void) | null = null;
	private _loginToken: AccountToken | null = null;
	public get loginTokenId(): string | null {
		return this._loginToken ? this._loginToken.getId() : null;
	}

	public isLoggedIn(): this is { readonly account: Account; } {
		return this.account !== null;
	}

	constructor(server: IServerSocket<IDirectoryClient>, socket: IncomingSocket, auth: unknown) {
		super(server, socket, [DirectoryClientSchema, ClientDirectorySchema], GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		this.logger.debug('Connected');
		ConnectionManagerClient.onConnect(this, auth);
		if (!this.isConnected()) {
			this.logger.warning('Client disconnect before onConnect finished');
			queueMicrotask(() => {
				this.onDisconnect('isConnected check failed');
			});
		}
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
	public setAccount(account: null): void;
	public setAccount(account: Account, token: AccountToken): void;
	public setAccount(account: Account | null, token?: AccountToken): void {
		if (this._account === account)
			return;
		this.logger.debug(`Set account ${account ? account.id : '[none]'}`);
		if (this._account) {
			Assert(this.rooms.has(this._account.associatedConnections));
			this.setCharacter(null);
			this._account.touch();
			this.leaveRoom(this._account.associatedConnections);
			this._loginToken = null;
			this._loginTokenEventUnsubscribe?.();
			this._loginTokenEventUnsubscribe = null;
			this._account = null;
		}
		if (account) {
			Assert(token?.reason === AccountTokenReason.LOGIN);
			account.touch();
			this._account = account;
			this._loginToken = token;
			this._loginTokenEventUnsubscribe = token.onAny((ev) => this.onTokenEvent(ev));
			this.joinRoom(account.associatedConnections);
		}
	}

	private onTokenEvent(event: Partial<TypedEventEmitterEvents<AccountToken>>): void {
		if (event.tokenDestroyed != null) {
			Assert(this._loginToken === event.tokenDestroyed);
			this.onAccountTokenDestroyed();
		}
		if (event.extended != null) {
			Assert(this._loginToken === event.extended);
			this.sendMessage('loginTokenChanged', {
				value: event.extended.value,
				expires: event.extended.expires,
			});
		}
	}

	private onAccountTokenDestroyed(): void {
		this.character?.markForDisconnect();

		if (this._account != null) {
			this.setAccount(null);
			this.sendConnectionStateUpdate();
		}

		this.logger.verbose(`${this.id} logged out`);
	}

	/**
	 * Set or clear the character this connection is using
	 * @param character - The character to set or `null` to clear
	 */
	public setCharacter(character: Character | null): void {
		if (this._character === character)
			return;
		this.logger.debug(`Set character ${character ? character.baseInfo.id : '[none]'}`);
		if (this._character) {
			Assert(this._character.assignedClient === this);
			this._character.assignedClient = null;
			this._character = null;
		}
		if (character) {
			Assert(this._account === character.baseInfo.account);
			Assert(character.assignedClient == null);
			this._character = character;
			character.assignedClient = this;
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
