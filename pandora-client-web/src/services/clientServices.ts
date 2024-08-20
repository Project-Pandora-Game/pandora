import { BaseServicesDefinition, Satisfies, ServiceManager } from 'pandora-common';
import { DirectoryConnectorServiceProvider, type DirectoryConnector } from '../networking/directoryConnector';
import { AccountManagerServiceProvider, type AccountManager } from './accountLogic/accountManager';
import { DirectMessageManagerServiceProvider, type DirectMessageManager } from './accountLogic/directMessages/directMessageManager';
import { NotificationHandlerServiceProvider, type NotificationHandler } from './notificationHandler';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		directoryConnector: DirectoryConnector;
		accountManager: AccountManager;
		notificationHandler: NotificationHandler;
		directMessageManager: DirectMessageManager;
	},
	BaseServicesDefinition
>;

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateClientUsermodeServices(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>()
		.registerService(DirectoryConnectorServiceProvider)
		.registerService(AccountManagerServiceProvider)
		.registerService(NotificationHandlerServiceProvider)
		.registerService(DirectMessageManagerServiceProvider);
}
