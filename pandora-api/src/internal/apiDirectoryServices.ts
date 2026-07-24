import { ServiceManager, type BaseServicesDefinition, type Satisfies } from 'pandora-common';
import { ApiDirectoryConnectorServiceProvider, type ApiDirectoryConnector } from './apiDirectoryConnector.ts';

/** Services available on Padora's client, when running in normal user mode. */
export type ApiDirectoryServices = Satisfies<
	{
		directoryConnector: ApiDirectoryConnector;
	},
	BaseServicesDefinition
>;

/**
 * Generates an un-initialized service manager containing all API-Directory services.
 */
export function GenerateApiDirectoryServices(): ServiceManager<ApiDirectoryServices> {
	return new ServiceManager<ApiDirectoryServices>({})
		.registerService(ApiDirectoryConnectorServiceProvider);
}
