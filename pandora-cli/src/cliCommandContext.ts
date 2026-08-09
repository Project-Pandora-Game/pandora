import type { PandoraApi } from 'pandora-api/api';
import type { CommandRunner, ICommandExecutionContext, IEmpty, Logger, ServiceManager } from 'pandora-common';
import type { CliServices } from './services/cliServices.ts';

export interface CliCommandExecutionContext extends ICommandExecutionContext {
	serviceManager: ServiceManager<CliServices>;
	getApi: () => Promise<PandoraApi>;
	logger: Logger;

	/** Get the global help text for all commands. Passed this way to avoid cyclic dependencies. */
	getGlobalHelp: () => string;
}

export type CliCommand<TCommandExecutionContext extends ICommandExecutionContext> = {
	key: string;
	usage: string;
	description: string;
	handler: CommandRunner<TCommandExecutionContext, IEmpty>;
};
