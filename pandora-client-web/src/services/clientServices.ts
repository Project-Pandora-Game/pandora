import type { Immutable } from 'immer';
import { BaseServicesDefinition, Satisfies, ServiceManager, type IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { DirectoryConnectorServiceProvider, type DirectoryConnector } from '../networking/directoryConnector.ts';
import type { ShardConnector } from '../networking/shardConnector.ts';
import { AccountManagerServiceProvider, type IAccountManager } from './accountLogic/accountManager.ts';
import { DirectMessageManagerServiceProvider, type DirectMessageManager } from './accountLogic/directMessages/directMessageManager.ts';
import { AudioServiceProvider, type AudioService } from './audio.ts';
import { BrowserPermissionManagerServiceProvider, type BrowserPermissionManager } from './browserPermissionManager.ts';
import { NotificationHandlerServiceProvider, type NotificationHandler } from './notificationHandler.tsx';
import { ScreenResolutionServiceProvider, type ScreenResolutionService } from './screenResolution/screenResolution.ts';
import { ShardConnectionManagerServiceProvider, type IShardConnectionManager } from './shardConnectionManager.ts';
import { UserActivationServiceProvider, type UserActivationService } from './userActivation.ts';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		screenResolution: ScreenResolutionService;
		browserPermissionManager: BrowserPermissionManager;
		userActivation: UserActivationService;
		audio: AudioService;
		directoryConnector: DirectoryConnector;
		accountManager: IAccountManager;
		notificationHandler: NotificationHandler;
		directMessageManager: DirectMessageManager;
		shardConnectionManager: IShardConnectionManager;
	},
	BaseServicesDefinition
>;

/**
 * Services available on Padora's client, when running in normal user mode and connected to a shard.
 * Instance can be queried from `shardConnectionManager` service.
 */
export type ClientGameLogicServices = Satisfies<
	{
		shardConnector: ShardConnector;
	},
	BaseServicesDefinition
>;

export type ClientGameLogicServicesDependencies = ClientServices & {
	connectionInfo: Immutable<IDirectoryCharacterConnectionInfo>;
};

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateClientUsermodeServices(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>({})
		.registerService(ScreenResolutionServiceProvider)
		.registerService(BrowserPermissionManagerServiceProvider)
		.registerService(UserActivationServiceProvider)
		.registerService(AudioServiceProvider)
		.registerService(DirectoryConnectorServiceProvider)
		.registerService(AccountManagerServiceProvider)
		.registerService(NotificationHandlerServiceProvider)
		.registerService(DirectMessageManagerServiceProvider)
		.registerService(ShardConnectionManagerServiceProvider);
}
