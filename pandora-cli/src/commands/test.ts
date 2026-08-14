import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { CreateCliCommand } from '../commandUtils/createCommand.ts';

export const COMMAND_TEST: CliCommand<CliCommandExecutionContext> = {
	key: 'test',
	hidden: true,
	usage: '',
	description: `Quick command to test a functionality of the API. Does nothing by default.`,
	handler: CreateCliCommand()
		.handler(async ({ getApi, logger }) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const api = await getApi();
			logger.info('This command is for quickly writing test code. It does nothing by itself.');

			// Space to test functionality
		}),
};
