import { AssertNever, CommandSelectorEnum } from 'pandora-common';
import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { CreateCliCommand } from '../commandUtils/createCommand.ts';

export const COMMAND_TOKEN: CliCommand<CliCommandExecutionContext> = {
	key: 'token',
	usage: '…',
	description: `Interact with Pandora tokens. Use this without further arguments for more detailed help.`,
	handler: CreateCliCommand()
		.fork('subcommand', (forkCtx) => {
			return {
				current: {
					description: 'Interact with the token used by the CLI. Use this without further arguments for more detailed help.',
					handler: forkCtx.fork('subcommand_current', (currentForkCtx) => ({
						info: {
							description: 'Get info about the current token.',
							handler: currentForkCtx
								.argumentOptional('format', CommandSelectorEnum(['text', 'json']))
								.handler(async ({ getApi, logger }, { format = 'text' }) => {
									const api = await getApi();

									const info = await api.token.getCurrentTokenInfo();

									if (info.is_err()) {
										logger.error('Error getting token info:', info.error);
										return false;
									}

									const {
										accountId,
										tokenId,
										tokenScopes,
										tokenExpires,
									} = info.value;

									if (format === 'text') {
										process.stdout.write(
											`Account id: ${accountId}\n` +
											`Token id: ${tokenId}\n` +
											`Token scopes:\n` +
											(tokenScopes.length > 0 ? tokenScopes.map((s) => `  - ${s}\n`).join('') : '  - Basic\n') +
											`Token expires: ${tokenExpires.map_or('Never', (d) => d.toISOString())}\n`,
										);
									} else if (format === 'json') {
										process.stdout.write(JSON.stringify({
											accountId,
											tokenId,
											tokenScopes,
											tokenExpires: tokenExpires.map_or(null, (d) => d.toISOString()),
										}, undefined, '  ') + '\n');
									} else {
										AssertNever(format);
									}

									return true;
								}),
						},
					})),
				},
			};
		}),
};
