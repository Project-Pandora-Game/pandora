import type { IIncomingConnection, IDirectoryShard } from 'pandora-common';
import type { Shard } from '../shard/shard';
import type { IConnectedTokenInfo } from '../shard/shardTokenStore';

export enum ConnectionType {
	SHARD,
	CLIENT,
}

export interface IConnectionShard extends IIncomingConnection<IDirectoryShard> {
	readonly type: ConnectionType.SHARD;
	/** The associated shard */
	shard: Shard | null;
	/** Get token info for shard */
	getTokenInfo(): Readonly<IConnectedTokenInfo>;
}
