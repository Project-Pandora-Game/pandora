import { BaseServicesDefinition, Satisfies, ServiceManager } from 'pandora-common';
import { DirectoryConnectorServiceProvider, type DirectoryConnector } from '../networking/directoryConnector.ts';
import { AccountManagerServiceProvider, type AccountManager } from './accountLogic/accountManager.ts';
import { DirectMessageManagerServiceProvider, type DirectMessageManager } from './accountLogic/directMessages/directMessageManager.ts';
import { AudioServiceProvider, type AudioService } from './audio.ts';
import { BrowserPermissionManagerServiceProvider, type BrowserPermissionManager } from './browserPermissionManager.ts';
import { NotificationHandlerServiceProvider, type NotificationHandler } from './notificationHandler.tsx';
import { ShardConnectionManagerServiceProvider, type IShardConnectionManager } from './shardConnectionManager.ts';
import { UserActivationServiceProvider, type UserActivationService } from './userActivation.ts';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		browserPermissionManager: BrowserPermissionManager;
		userActivation: UserActivationService;
		audio: AudioService;
		directoryConnector: DirectoryConnector;
		accountManager: AccountManager;
		notificationHandler: NotificationHandler;
		directMessageManager: DirectMessageManager;
		shardConnectionManager: IShardConnectionManager;
	},
	BaseServicesDefinition
>;

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateClientUsermodeServices(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>()
		.registerService(BrowserPermissionManagerServiceProvider)
		.registerService(UserActivationServiceProvider)
		.registerService(AudioServiceProvider)
		.registerService(DirectoryConnectorServiceProvider)
		.registerService(AccountManagerServiceProvider)
		.registerService(NotificationHandlerServiceProvider)
		.registerService(DirectMessageManagerServiceProvider)
		.registerService(ShardConnectionManagerServiceProvider);
}
