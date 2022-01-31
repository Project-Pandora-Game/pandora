import type { IConnectionBase, IDirectoryClientBase } from 'pandora-common';
import type { Account } from '../account/account';

export enum ConnectionType {
	SHARD,
	CLIENT,
}

export interface IConnectionClient extends IConnectionBase<IDirectoryClientBase> {
	readonly type: ConnectionType.CLIENT;
	/** The current account this connection is logged in as or `null` if it isn't */
	readonly account: Account | null;
	/** ID of the client, primarily used for logging */
	readonly id: string;

	isConnected(): boolean;
	isLoggedIn(): boolean;

	/**
	 * Set or clear the account this connection is logged in as
	 * @param account - The account to set or `null` to clear
	 */
	setAccount(account: Account | null): void;
}
