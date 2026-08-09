import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { COMMAND_HELP } from './help.ts';
import { COMMAND_TOKEN } from './token.ts';

export const CLI_COMMANDS: readonly CliCommand<CliCommandExecutionContext>[] = [
	COMMAND_HELP,
	COMMAND_TOKEN,
];
