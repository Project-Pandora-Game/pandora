import { freeze } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	Assert,
	AsyncSynchronized,
	GetLogger,
	Service,
	ServiceManager,
	type IDirectoryCharacterConnectionInfo,
	type IService,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProvider,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { SocketIOConnector } from '../networking/socketio_connector.ts';
import { Observable, type ReadonlyObservable } from '../observable.ts';
import { GenerateClientGameLogicServices, type ClientGameLogicServices, type ClientGameLogicServicesDependencies, type ClientServices } from './clientServices.ts';

export type ShardConnectorDependencies = Pick<ClientServices, 'accountManager' | 'notificationHandler'>;

type ShardConnectionManagerServiceConfig = Satisfies<{
	dependencies: Omit<ClientServices, 'shardConnectionManager'>;
	events: false;
}, ServiceConfigBase>;

export interface IShardConnectionManager extends IService<ShardConnectionManagerServiceConfig> {
	readonly gameLogicServices: ReadonlyObservable<ServiceProvider<ClientGameLogicServices> | null>;
}

/**
 * Service containing the current shard connector.
 */
class ShardConnectionManager extends Service<ShardConnectionManagerServiceConfig> implements IShardConnectionManager {
	private readonly logger = GetLogger('ShardConnectionManager');

	private readonly _gameLogicServices = new Observable<ServiceManager<ClientGameLogicServices, ClientGameLogicServicesDependencies> | null>(null);

	public get gameLogicServices(): ReadonlyObservable<ServiceProvider<ClientGameLogicServices> | null> {
		return this._gameLogicServices;
	}

	protected override serviceInit(): void {
		const { accountManager } = this.serviceDeps;

		accountManager.on('accountChanged', ({ character }) => {
			this._handleActiveCharacterChanged(character)
				.catch((err) => {
					this.logger.error('Error processing account changed request:', err);
				});
		});
	}

	@AsyncSynchronized('object')
	private async _handleActiveCharacterChanged(character: IDirectoryCharacterConnectionInfo | null): Promise<void> {
		if (character) {
			await this._connectToShard(character);
		} else {
			this._disconnectFromShard();
		}
	}

	private async _connectToShard(info: IDirectoryCharacterConnectionInfo): Promise<void> {
		const currentShardConnector = this._gameLogicServices.value?.services.shardConnector;
		if (currentShardConnector != null && currentShardConnector.connectionInfoMatches(info)) {
			return;
		}
		this._disconnectFromShard();
		this.logger.debug('Requesting connect to shard: ', info);

		const gameLogicServices = GenerateClientGameLogicServices({
			...this.serviceDeps,
			shardConnectionManager: this,
			connectionInfo: freeze(cloneDeep(info), true),
		});

		await gameLogicServices.load();

		const shardConnector = gameLogicServices.services.shardConnector;
		Assert(shardConnector != null);

		Assert(this._gameLogicServices.value == null);
		this._gameLogicServices.value = gameLogicServices;

		shardConnector.connect(SocketIOConnector);
	}

	private _disconnectFromShard(): void {
		const gameLogicServices = this._gameLogicServices.value;
		if (gameLogicServices != null) {
			this.logger.debug('Disconnecting from shard');
			gameLogicServices.services.shardConnector?.disconnect();
			this._gameLogicServices.value = null;
		}
	}
}

export const ShardConnectionManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'shardConnectionManager', ShardConnectionManagerServiceConfig> = {
	name: 'shardConnectionManager',
	ctor: ShardConnectionManager,
	dependencies: {
		screenResolution: true,
		browserPermissionManager: true,
		userActivation: true,
		audio: true,
		directoryConnector: true,
		accountManager: true,
		notificationHandler: true,
		directMessageManager: true,
	},
};
