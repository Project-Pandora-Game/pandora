import type { CharacterId, IConnection, IConnectionBase, IDirectoryClientBase, IDirectoryShardBase, IShardDirectoryArgument, ShardInfo } from 'pandora-common';
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
	isLoggedIn(): this is { readonly account: Account; };

	/**
	 * Set or clear the account this connection is logged in as
	 * @param account - The account to set or `null` to clear
	 */
	setAccount(account: Account | null): void;
}

export interface IConnectionShard extends IConnection<IDirectoryShardBase, true> {
	readonly type: ConnectionType.SHARD;
	readonly id: string;
	/** Map of character ids to account id */
	readonly characters: Map<CharacterId, number>;

	updateInfo(info: IShardDirectoryArgument['sendInfo'], connecting: boolean): Promise<{ invalidate: CharacterId[]; }>;

	removeCharacter(characterId: CharacterId): void;

	getInfo(): Omit<ShardInfo, 'secret'>;

	addAccountCharacter(acc: Account, id: CharacterId, accessId: string): void;
}
