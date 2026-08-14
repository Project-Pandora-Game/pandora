import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { CreateCliCommand } from '../commandUtils/createCommand.ts';

export const COMMAND_HELP: CliCommand<CliCommandExecutionContext> = {
	key: 'help',
	usage: '',
	description: `Print this help.`,
	handler: CreateCliCommand()
		.handler(({ getGlobalHelp }) => {
			process.stdout.write(getGlobalHelp());
		}),
};
