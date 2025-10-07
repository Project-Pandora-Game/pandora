import {
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceManager,
	type ServiceProvider,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { ClientGameLogicServices, ClientGameLogicServicesDependencies, ClientServices } from '../../services/clientServices.ts';
import type { IShardConnectionManager } from '../../services/shardConnectionManager.ts';

type EditorShardConnectionManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service containing fake data for editor "shard" connection.
 */
export class EditorShardConnectionManager extends Service<EditorShardConnectionManagerServiceConfig> implements IShardConnectionManager {
	private readonly _gameLogicServices = new Observable<ServiceManager<ClientGameLogicServices, ClientGameLogicServicesDependencies> | null>(null);

	public get gameLogicServices(): ReadonlyObservable<ServiceProvider<ClientGameLogicServices> | null> {
		return this._gameLogicServices;
	}
}

export const EditorShardConnectionManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'shardConnectionManager', EditorShardConnectionManagerServiceConfig> = {
	name: 'shardConnectionManager',
	ctor: EditorShardConnectionManager,
	dependencies: {
	},
};
