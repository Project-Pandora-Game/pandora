import { BaseServicesDefinition, Satisfies, ServiceManager } from 'pandora-common';
import { CliApiManagerServiceProvider, type CliApiManagerService } from './cliApiManager.ts';

/** Services available on Padora's client, when running in normal user mode. */
export type CliServices = Satisfies<
	{
		apiManager: CliApiManagerService;
	},
	BaseServicesDefinition
>;

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateCliServices(): ServiceManager<CliServices> {
	return new ServiceManager<CliServices>({})
		.registerService(CliApiManagerServiceProvider);
}
