import type { IIncomingConnection } from 'pandora-common';
import type { IDirectoryShard } from 'pandora-common/networking/api/directory_shard';
import type { Shard } from '../shard/shard.ts';
import type { IConnectedTokenInfo } from '../shard/shardTokenStore.ts';

export interface IConnectionShard extends IIncomingConnection<IDirectoryShard> {
	/** The associated shard */
	shard: Shard | null;
	/** Time at which this connection was created */
	readonly connectionTime: number;
	/** Get token info for shard */
	getTokenInfo(): Readonly<IConnectedTokenInfo>;
}
