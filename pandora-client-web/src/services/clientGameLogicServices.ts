import type { Immutable } from 'immer';
import { BaseServicesDefinition, Satisfies, ServiceManager, type IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { ShardConnectorServiceProvider, type ShardConnector } from '../networking/shardConnector.ts';
import type { ClientServices } from './clientServices.ts';
import { GameStateManagerServiceProvider, type IGameStateManager } from './gameLogic/gameStateManager.ts';

/**
 * Services available on Padora's client, when running in normal user mode and connected to a shard.
 * Instance can be queried from `shardConnectionManager` service.
 */
export type ClientGameLogicServices = Satisfies<
	{
		shardConnector: ShardConnector;
		gameState: IGameStateManager;
	},
	BaseServicesDefinition
>;

export type ClientGameLogicServicesDependencies = ClientServices & {
	connectionInfo: Immutable<IDirectoryCharacterConnectionInfo>;
};

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateClientGameLogicServices(dependencies: ClientGameLogicServicesDependencies): ServiceManager<ClientGameLogicServices, ClientGameLogicServicesDependencies> {
	return new ServiceManager<ClientGameLogicServices, ClientGameLogicServicesDependencies>(dependencies)
		.registerService(ShardConnectorServiceProvider)
		.registerService(GameStateManagerServiceProvider);
}
