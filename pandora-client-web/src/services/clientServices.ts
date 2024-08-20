import type { BaseServicesDefinition, Satisfies } from 'pandora-common';
import type { DirectoryConnector } from '../networking/directoryConnector';
import type { AccountManager } from './accountLogic/accountManager';
import type { DirectMessageManager } from './accountLogic/directMessages/directMessageManager';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		accountManager: AccountManager;
		directoryConnector: DirectoryConnector;
		directMessageManager: DirectMessageManager;
	},
	BaseServicesDefinition
>;
