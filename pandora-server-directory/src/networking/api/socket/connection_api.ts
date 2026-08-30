import { Assert, AssertNever, EMPTY_ARRAY, GetLogger, IncomingConnection, IncomingSocket, IServerSocket, type PandoraAccessTokenInfo, type PandoraAccessTokenScope } from 'pandora-common';
import type { BotId } from 'pandora-common/bots';
import { ApiDirectorySchema, DirectoryApiSchema, type IApiDirectory, type IDirectoryApi } from 'pandora-common/networking/api/directory_api';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import type { Account } from '../../../account/account.ts';
import type { Bot } from '../../../bots/bot.ts';
import { ConnectionManagerApi } from './manager_api.ts';

/** Class housing connection from public API */
export class ApiConnection extends IncomingConnection<IDirectoryApi, IApiDirectory, IncomingSocket> {
	/** Hash of the actual access token. See `AccountSecureAccessTokenStore::hashToken` */
	public readonly tokenHash: string;
	/** Id of the token being used. */
	public readonly tokenId: string;
	public readonly connectionTime: number;

	private _account: Account | null;
	private _accountEventUnsubscribe: (() => void) | null = null;
	private _tokenEventUnsubscribe: (() => void) | null = null;

	private readonly _registeredBots: Map<BotId, Bot> = new Map<BotId, Bot>();
	public get registeredBots(): ReadonlyMap<BotId, Bot> {
		return this._registeredBots;
	}

	constructor(server: IServerSocket<IDirectoryApi>, socket: IncomingSocket, account: Account, tokenHash: string, tokenInfo: PandoraAccessTokenInfo) {
		super(server, socket, [DirectoryApiSchema, ApiDirectorySchema], GetLogger('Connection-Api', `[Connection-Api ${socket.id}]`));

		// Link to the account
		account.touch();
		this._account = account;
		this.tokenHash = tokenHash;
		this.tokenId = tokenInfo.id;
		this._accountEventUnsubscribe = account.onAny((event) => {
			if ('accountInfoChanged' in event) {
				if (this._account != null) {
					const verifyResult = this._account.secure.accessTokens.verifyToken(this.tokenHash, EMPTY_ARRAY);
					if (verifyResult !== 'ok') {
						this._onTokenReverifyError(verifyResult);
					}
				}
			}
		});
		this._tokenEventUnsubscribe = account.secure.accessTokens.onAny((event) => {
			if (event.tokenInvalidated === this.tokenHash) {
				if (this._account != null) {
					// Slight delay to let ongoing responses finish
					// This is not a security hole, as any existing request will already perform the action
					// and any new one will fail on validation
					setTimeout(() => {
						this.disconnect('token invalidated');
					}, 100);
				}
			}
		});
		account.associatedApiConnections.join(this);

		this.connectionTime = Date.now();
		this.logger.verbose(`Connected; Account: ${account.id}; Token: ${tokenInfo.id}`);
		ConnectionManagerApi.onConnect(this);

		if (!this.isConnected()) {
			this.logger.warning('Disconnect before onConnect finished');
			queueMicrotask(() => {
				this.onDisconnect('isConnected check failed');
			});
		}
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerApi.onDisconnect(this);
		this._deAuth('disconnected');
		super.onDisconnect(reason);
	}

	protected onMessage<K extends keyof IApiDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IApiDirectory>[K],
	): Promise<SocketInterfaceResponse<IApiDirectory>[K]> {
		return ConnectionManagerApi.onMessage(messageType, message, this);
	}

	public override awaitResponse(_messageType: unknown, _message: unknown, _timeout?: unknown): Promise<never> {
		throw new Error('Invalid operation');
	}

	public disconnect(reason: string): void {
		this._deAuth(reason);
		this.socket.disconnect();
	}

	public verifyTokenUse(requiredScopes: readonly PandoraAccessTokenScope[]): boolean {
		if (this._account == null)
			return false;

		const verifyResult = this._account.secure.accessTokens.verifyToken(this.tokenHash, requiredScopes);
		if (verifyResult === 'ok') {
			return true;
		}

		this._onTokenReverifyError(verifyResult);
		return false;
	}

	private _onTokenReverifyError(verifyResult: 'disabledAccount' | 'invalidToken' | 'missingScopes'): void {
		// Check if the token was altogether invalidated and disconnect the connection if yes
		if (verifyResult === 'disabledAccount') {
			queueMicrotask(() => {
				this.disconnect('account disabled');
			});
		} else if (verifyResult === 'invalidToken') {
			queueMicrotask(() => {
				this.disconnect('token expired');
			});
		} else if (verifyResult === 'missingScopes') {
			// No action if only missing scopes - the connection remains usable
		} else {
			AssertNever(verifyResult);
		}
	}

	public verifyTokenUseAndGetAccount(requiredScopes: readonly PandoraAccessTokenScope[]): Account | null {
		return this.verifyTokenUse(requiredScopes) ? this._account : null;
	}

	/**
	 * Add a bot registration to this connection.
	 */
	public addBotRegistration(bot: Bot): void {
		if (this._registeredBots.has(bot.id) || this._account == null)
			return;
		this.logger.debug(`Register bot "${bot.id}"`);

		bot.touch();
		this._registeredBots.set(bot.id, bot);
		bot.associatedApiConnections.join(this);

		// Send initial state data
		// TODO
	}

	/**
	 * Remove a bot registration from this connection.
	 */
	public removeBotRegistration(bot: Bot): void {
		if (!this._registeredBots.has(bot.id))
			return;
		this.logger.debug(`Unregister bot "${bot.id}"`);

		Assert(this.rooms.has(bot.associatedApiConnections));

		bot.touch();
		bot.associatedApiConnections.leave(this);
		this._registeredBots.delete(bot.id);
	}

	/** Deauthenticate this connection. This does not close the connection - it should be done right before close or in response to it */
	private _deAuth(reason: string): void {
		if (this._account == null)
			return;

		this.logger.debug(`Deauthenticate (${reason})`);

		Assert(this.rooms.has(this._account.associatedApiConnections));
		this._account.touch();
		this._account.associatedApiConnections.leave(this);
		this._accountEventUnsubscribe?.();
		this._accountEventUnsubscribe = null;
		this._tokenEventUnsubscribe?.();
		this._tokenEventUnsubscribe = null;
		this._account = null;

		// Clear bot assignments
		for (const bot of Array.from(this._registeredBots.values())) {
			this.removeBotRegistration(bot);
		}
		Assert(this._registeredBots.size === 0);
	}
}
