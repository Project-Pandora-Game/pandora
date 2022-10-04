import type { IIncomingConnection, IDirectoryClient, IDirectoryShard } from 'pandora-common';
import type { Account } from '../account/account';
import type { Character } from '../account/character';
import type { Shard } from '../shard/shard';

export enum ConnectionType {
	SHARD,
	CLIENT,
}

export interface IConnectionClient extends IIncomingConnection<IDirectoryClient> {
	readonly type: ConnectionType.CLIENT;
	/** The current account this connection is logged in as or `null` if it isn't */
	readonly account: Account | null;
	/** The current character this connection is using or `null` if none */
	readonly character: Character | null;

	isLoggedIn(): this is { readonly account: Account; };

	/**
	 * Set or clear the account this connection is logged in as
	 * @param account - The account to set or `null` to clear
	 */
	setAccount(account: Account | null): void;

	/**
	 * Set or clear the character this connection is using
	 * @param character - The character to set or `null` to clear
	 */
	setCharacter(character: Character | null): void;

	sendConnectionStateUpdate(): void;
}

export interface IConnectionShard extends IIncomingConnection<IDirectoryShard> {
	readonly type: ConnectionType.SHARD;
	/** The associated shard */
	shard: Shard | null;
}
