import { IDirectoryClient, GetLogger } from 'pandora-common';
import type { Socket } from 'socket.io';
import type { Account } from '../account/account';
import { ConnectionType, IConnectionClient } from './common';
import ConnectionManagerClient from './manager_client';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a client */
export class SocketIOConnectionClient extends SocketIOConnection<IDirectoryClient> implements IConnectionClient {
	readonly type: ConnectionType.CLIENT = ConnectionType.CLIENT;

	/** The current account this connection is logged in as or `null` if it isn't */
	private _account: Account | null = null;
	get account(): Account | null {
		return this._account;
	}

	get id(): string {
		return this.socket.id;
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
}
