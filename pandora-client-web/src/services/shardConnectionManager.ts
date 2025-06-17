import {
	GetLogger,
	Service,
	type IDirectoryCharacterConnectionInfo,
	type IService,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { ShardConnector } from '../networking/shardConnector.ts';
import { SocketIOConnector } from '../networking/socketio_connector.ts';
import { Observable, type ReadonlyObservable } from '../observable.ts';
import type { ClientServices } from './clientServices.ts';

type ShardConnectionManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'directoryConnector' | 'accountManager' | 'notificationHandler'>;
	events: false;
}, ServiceConfigBase>;

export interface IShardConnectionManager extends IService<ShardConnectionManagerServiceConfig> {
	readonly shardConnector: ReadonlyObservable<ShardConnector | null>;
}

/**
 * Service containing the current shard connector.
 */
export class ShardConnectionManager extends Service<ShardConnectionManagerServiceConfig> implements IShardConnectionManager {
	private readonly logger = GetLogger('ShardConnectionManager');

	private readonly _shardConnector = new Observable<ShardConnector | null>(null);

	public get shardConnector(): ReadonlyObservable<ShardConnector | null> {
		return this._shardConnector;
	}

	protected override serviceInit(): void {
		const { accountManager } = this.serviceDeps;

		accountManager.on('accountChanged', ({ character }) => {
			this._handleActiveCharacterChanged(character);
		});
	}

	private _handleActiveCharacterChanged(character: IDirectoryCharacterConnectionInfo | null): void {
		if (character) {
			this._connectToShard(character);
		} else {
			this._disconnectFromShard();
		}
	}

	private _connectToShard(info: IDirectoryCharacterConnectionInfo): void {
		const { directoryConnector, accountManager, notificationHandler } = this.serviceDeps;

		if (this._shardConnector.value?.connectionInfoMatches(info)) {
			return;
		}
		this._disconnectFromShard();
		this.logger.debug('Requesting connect to shard: ', info);

		const shardConnector = new ShardConnector(info, directoryConnector, accountManager, notificationHandler);
		this._shardConnector.value = shardConnector;
		shardConnector.connect(SocketIOConnector);
	}

	private _disconnectFromShard(): void {
		if (this._shardConnector.value) {
			this.logger.debug('Disconnecting from shard');
			this._shardConnector.value.disconnect();
			this._shardConnector.value = null;
		}
	}
}

export const ShardConnectionManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'shardConnectionManager', ShardConnectionManagerServiceConfig> = {
	name: 'shardConnectionManager',
	ctor: ShardConnectionManager,
	dependencies: {
		directoryConnector: true,
		accountManager: true,
		notificationHandler: true,
	},
};
