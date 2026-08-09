import { GetLogger, ParseNotNullable, type ServiceManager } from 'pandora-common';
import type { CliCommandExecutionContext } from './cliCommandContext.ts';
import { CLI_COMMANDS } from './commands/_index.ts';
import { GetHelp } from './help.ts';
import type { CliServices } from './services/cliServices.ts';

export async function RunCliCommand(serviceManager: ServiceManager<CliServices>, commandArgs: string[]): Promise<void> {
	if (commandArgs.length === 0 || !commandArgs[0].trim()) {
		process.stdout.write(GetHelp());
		return;
	}

	const logger = GetLogger('Command');

	const command = CLI_COMMANDS.find((c) => c.key === commandArgs[0]) ?? null;
	if (!command) {
		logger.fatal(`Unknown command "${commandArgs[0]}"`);
		return;
	}

	const ctx: CliCommandExecutionContext = {
		executionType: 'run',
		commandName: commandArgs[0],
		displayError(error) {
			logger.error(error);
		},

		serviceManager,
		getApi: () => {
			const manager = ParseNotNullable(serviceManager.services.apiManager);
			return manager.getApi();
		},
		logger,
		getGlobalHelp: GetHelp,
	};

	const result = await command.handler.runTokenized(ctx, {}, commandArgs.slice(1));

	if (result) {
		logger.debug('Command completed successfully');
	} else {
		logger.debug('Command failed');
		process.exitCode = 1;
	}
}
