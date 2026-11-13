import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { RunUpdatesCommand } from '../updateAnnouncements.ts';

export const COMMAND_UPDATES: CliCommand<CliCommandExecutionContext> = {
	key: 'updates',
	usage: '[options]',
	description: 'Generate a production update announcement without deploying. Use --help for options.',
	handler: {
		runTokenized: async (_context, _arguments, rest) => await RunUpdatesCommand(rest),
	},
};
