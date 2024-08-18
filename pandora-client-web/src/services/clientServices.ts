import type { BaseServicesDefinition, Satisfies } from 'pandora-common';
import type { DirectoryConnector } from '../networking/directoryConnector';
import type { DirectMessageManager } from './accountLogic/directMessages/directMessageManager';

/** Services available on Padora's client, when running in normal user mode. */
export type ClientServices = Satisfies<
	{
		directoryConnector: DirectoryConnector;
		directMessageManager: DirectMessageManager;
	},
	BaseServicesDefinition
>;
