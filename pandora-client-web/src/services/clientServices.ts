import { BaseServicesDefinition, Satisfies, ServiceManager } from 'pandora-common';
import { DirectoryConnectorServiceProvider, type DirectoryConnector } from '../networking/directoryConnector';
import { AccountManagerServiceProvider, type AccountManager } from './accountLogic/accountManager';
import { DirectMessageManagerServiceProvider, type DirectMessageManager } from './accountLogic/directMessages/directMessageManager';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		accountManager: AccountManager;
		directoryConnector: DirectoryConnector;
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
		.registerService(DirectMessageManagerServiceProvider);
}
