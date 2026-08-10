import { AssertNever, CommandSelectorAnyQuotedString, CommandSelectorEnum, CommandSelectorNumber, LIMIT_SPACE_SEARCH_COUNT, SpaceSearchSortSchema } from 'pandora-common';
import type { CliCommand, CliCommandExecutionContext } from '../cliCommandContext.ts';
import { CreateCliCommand } from '../commandUtils/createCommand.ts';

export const COMMAND_SPACESEARCH: CliCommand<CliCommandExecutionContext> = {
	key: 'spaceSearch',
	usage: '…',
	description: `Search through existing spaces. Use this without further arguments for more detailed help.`,
	handler: CreateCliCommand()
		.fork('subcommand', (forkCtx) => {
			return {
				public: {
					description: `Search through public spaces.\nUsage: spaceSearch public [name filter] [limit] [skip] [sort order: ${SpaceSearchSortSchema.options.join('|')}] [format: text|json]`,
					handler: forkCtx
						.argumentOptional('name_filter', CommandSelectorAnyQuotedString())
						.argumentOptional('limit', CommandSelectorNumber({ min: 1, max: LIMIT_SPACE_SEARCH_COUNT }))
						.argumentOptional('skip', CommandSelectorNumber({ min: 0 }))
						.argumentOptional('sort_order', CommandSelectorEnum(SpaceSearchSortSchema.options))
						.argumentOptional('format', CommandSelectorEnum(['text', 'json']))
						.handler(async ({ getApi, logger }, {
							name_filter,
							limit = LIMIT_SPACE_SEARCH_COUNT,
							skip = 0,
							sort_order = 'activity',
							format = 'text',
						}) => {
							const api = await getApi();

							const result = await api.spaceSearch.searchPublicSpaces({
								nameFilter: name_filter,
								sort: sort_order,
							}, limit, skip);

							if (result.is_err()) {
								logger.error('Error searching spaces:', result.error);
								return false;
							}

							if (format === 'text') {
								if (result.value.length === 0) {
									process.stdout.write('No spaces found\n');
								} else {
									for (const space of result.value) {
										process.stdout.write(
											`- Id: ${space.id}\n` +
											`  Name: ${space.name}\n` +
											`  Description: ${space.description.includes('\n') ? ('|\n    ' + space.description.replaceAll('\n', '\n    ')) : space.description}\n` +
											`  Public: ${space.public}\n` +
											`  Max characters: ${space.maxUsers}\n` +
											`  Owners: ${JSON.stringify(space.owners)}\n` +
											`  Activity score: ${space.activityScore}\n`,
										);
									}
								}
							} else if (format === 'json') {
								process.stdout.write(JSON.stringify((
									result.value
								), undefined, '  ') + '\n');
							} else {
								AssertNever(format);
							}

							return true;
						}),
				},
			};
		}),
};
