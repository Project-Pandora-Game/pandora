import type { IDirectoryShard, IIncomingConnection } from 'pandora-common';
import type { Shard } from '../shard/shard.ts';
import type { IConnectedTokenInfo } from '../shard/shardTokenStore.ts';

export enum ConnectionType {
	SHARD,
	CLIENT,
}

export interface IConnectionShard extends IIncomingConnection<IDirectoryShard> {
	readonly type: ConnectionType.SHARD;
	/** The associated shard */
	shard: Shard | null;
	/** Time at which this connection was created */
	readonly connectionTime: number;
	/** Get token info for shard */
	getTokenInfo(): Readonly<IConnectedTokenInfo>;
}
