import {
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import type { ShardConnector } from '../../networking/shardConnector.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { ClientServices } from '../../services/clientServices.ts';
import type { IShardConnectionManager } from '../../services/shardConnectionManager.ts';

type EditorShardConnectionManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service containing fake data for editor "shard" connection.
 */
export class EditorShardConnectionManager extends Service<EditorShardConnectionManagerServiceConfig> implements IShardConnectionManager {
	private readonly _shardConnector = new Observable<ShardConnector | null>(null);

	public get shardConnector(): ReadonlyObservable<ShardConnector | null> {
		return this._shardConnector;
	}
}

export const EditorShardConnectionManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'shardConnectionManager', EditorShardConnectionManagerServiceConfig> = {
	name: 'shardConnectionManager',
	ctor: EditorShardConnectionManager,
	dependencies: {
	},
};
