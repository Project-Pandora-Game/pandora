import { Assert, EMPTY_ARRAY, GetLogger, IncomingConnection, IncomingSocket, IServerSocket, type PandoraAccessToken, type PandoraAccessTokenInfo, type PandoraAccessTokenScope } from 'pandora-common';
import { ApiDirectorySchema, DirectoryApiSchema, type IApiDirectory, type IDirectoryApi } from 'pandora-common/networking/api/directory_api';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import type { Account } from '../../../account/account.ts';
import { ConnectionType } from '../../common.ts';
import { ConnectionManagerApi } from './manager_api.ts';

/** Class housing connection from public API */
export class ApiConnection extends IncomingConnection<IDirectoryApi, IApiDirectory, IncomingSocket> {
	public readonly type: ConnectionType.API = ConnectionType.API;

	public readonly token: PandoraAccessToken;
	public readonly connectionTime: number;

	private _account: Account | null;
	private _tokenEventUnsubscribe: (() => void) | null = null;

	constructor(server: IServerSocket<IDirectoryApi>, socket: IncomingSocket, account: Account, token: PandoraAccessToken, tokenInfo: PandoraAccessTokenInfo) {
		super(server, socket, [DirectoryApiSchema, ApiDirectorySchema], GetLogger('Connection-Api', `[Connection-Api ${socket.id}]`));

		// Link to the account
		account.touch();
		this._account = account;
		this.token = token;
		this._tokenEventUnsubscribe = account.secure.accessTokens.onAny((event) => {
			if (event.tokenInvalidated === this.token) {
				if (this._account != null) {
					this.disconnect('token invalidated');
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

		if (this._account.secure.accessTokens.verifyToken(this.token, requiredScopes)) {
			return true;
		}

		// Check if the token was altogether invalidated
		if (!this._account.secure.accessTokens.verifyToken(this.token, EMPTY_ARRAY)) {
			queueMicrotask(() => {
				this.disconnect('token expired');
			});
		}
		return false;
	}

	public verifyTokenUseAndGetAccount(requiredScopes: readonly PandoraAccessTokenScope[]): Account | null {
		return this.verifyTokenUse(requiredScopes) ? this._account : null;
	}

	/** Deauthenticate this connection. This does not close the connection - it should be done right before close or in response to it */
	private _deAuth(reason: string): void {
		if (this._account == null)
			return;

		this.logger.debug(`Deauthenticate (${reason})`);

		Assert(this.rooms.has(this._account.associatedApiConnections));
		this._account.touch();
		this._account.associatedApiConnections.leave(this);
		this._tokenEventUnsubscribe?.();
		this._tokenEventUnsubscribe = null;
		this._account = null;
	}
}
