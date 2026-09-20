import { isEqual } from 'lodash-es';
import {
	Assert,
	AssertNever,
	COMMAND_STEP_PREPARSE_PROCESSORS,
	CommandArgumentNeedsQuotes,
	CommandArgumentQuote,
	CommandSelectorAnyQuotedString,
	CommandSelectorEnum,
	CommandSelectorNamedValue,
	CommandSelectorNumber,
	CommandStepOptional,
	GetLogger,
	LongestCommonPrefix,
	Result,
	Service,
	type ChatCharacterFullStatus,
	type CommandAutocompleteOption,
	type CommandAutocompleteResult,
	type CommandStepProcessor,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
	type SpaceId,
} from 'pandora-common';
import type { BotCommandArgumentDescriptor, BotCommandArgumentProcessor, BotCommandStructureResult, BotId } from 'pandora-common/bots';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import type { ChatInputCommandRunner } from '../../ui/components/chat/chatInputContext.ts';
import { CommandSelectorCharacter, type ICommandClientNeededContext } from '../../ui/components/chat/commandsHelpers.ts';
import type { AutocompleteDisplayData } from '../../ui/components/chat/commandsProcessor.ts';
import type { ClientGameLogicServices, ClientGameLogicServicesDependencies } from '../clientGameLogicServices.ts';

type BotInteractionsServiceConfig = Satisfies<{
	dependencies: Pick<ClientGameLogicServices, 'shardConnector' | 'gameState'> & Pick<ClientGameLogicServicesDependencies, never>;
	events: false;
}, ServiceConfigBase>;

/**
 * Class used for interacting with space's bot.
 *
 * It implements:
 * - Handling of custom bot commands
 */
export class BotInteractionsService extends Service<BotInteractionsServiceConfig> implements ChatInputCommandRunner {
	private readonly logger = GetLogger('BotInteractionsService');

	//#region Custom bot commands

	public async run(input: string): Promise<boolean> {
		const { commandName, rest } = BotInteractionsService._parseCommandName(input);
		const context = this._getCommandContext(commandName, 'run');
		if (context == null) {
			// Not ready to process bot commands
			toast(`Not ready to process bot commands`, TOAST_OPTIONS_ERROR);
			return false;
		}

		try {
			const loadResult = await this._loadCommandStructure(commandName, rest, context);
			if (loadResult.is_err()) {
				toast(`Failed to process command: ${loadResult.error}`, TOAST_OPTIONS_ERROR);
				return false;
			}
			const { structure, args, unparsedSuffix } = loadResult.value;

			const finalArgs = args.map((it) => it.parsedValue);

			// Process trailing argument (no space after it or it is a "rest" argument)
			if (structure.nextSegment == null) {
				if (rest.trim()) {
					toast(`Failed to process command: Unexpected input '${unparsedSuffix}' after last argument`, TOAST_OPTIONS_ERROR);
					return false;
				}
			} else if (structure.nextSegment === 'rest') {
				finalArgs.push(unparsedSuffix);
			} else {
				// It is a normal argument, just the last one
				const lastResult = BotInteractionsService._parseNextArgument(unparsedSuffix, structure.nextSegment, context);

				if (lastResult.is_err()) {
					toast(`Failed to process command: ${lastResult.error}`, TOAST_OPTIONS_ERROR);
					return false;
				}
				const { parsed, rest: lastSegmentRest } = lastResult.value;

				Assert(!lastSegmentRest, 'Last segment has followup after the command was already pre-parsed');
				finalArgs.push(parsed);
			}

			// Purge cache before running the command - this makes sure that if this errors, then any re-run does fresh parsing
			this._commandStructureCache = undefined;

			const result = await this.serviceDeps.shardConnector.awaitResponse('botCommandRun', {
				command: commandName,
				args: finalArgs,
			});

			if (result.result === 'ok') {
				return true;
			} else if (result.result === 'invalidCommand') {
				toast(`Unknown command '${commandName}'`, TOAST_OPTIONS_ERROR);
				return false;
			} else if (result.result === 'invalidArguments') {
				toast(`Error processing arguments: ${result.message}`, TOAST_OPTIONS_ERROR);
				return false;
			} else if (result.result === 'runError') {
				toast('Error running command' + (result.message ? (': ' + result.message) : ''), TOAST_OPTIONS_ERROR);
				return false;
			} else if (result.result === 'botError') {
				toast('The space\'s bot failed to process the command', TOAST_OPTIONS_ERROR);
				return false;
			} else if (result.result === 'botDisconnected') {
				toast('The space\'s bot is not currently available to process the command', TOAST_OPTIONS_ERROR);
				return false;
			} else if (result.result === 'noBot') {
				toast('This space has no bot to send the command to', TOAST_OPTIONS_ERROR);
				return false;
			}
			AssertNever(result);
		} catch (err) {
			toast('Error while processing command', TOAST_OPTIONS_ERROR);
			this.logger.warning(`Error while running command ${input} against `, BotInteractionsService._getCurrentCacheKey(context), ':\n', err);
			return false;
		}
	}

	public async autocomplete(input: string): Promise<CommandAutocompleteResult> {
		const { commandName, spacing, rest } = BotInteractionsService._parseCommandName(input);
		const context = this._getCommandContext(commandName, 'autocomplete');
		if (context == null) {
			// Not ready to process bot commands
			return null;
		}

		try {
			// If there is no space after commandName, we are autocompleting the command itself
			if (!spacing) {
				const commands = await this.serviceDeps.shardConnector.awaitResponse('botCommandsGet', {});
				// TODO: Cache the commands list

				if (commands.result === 'ok') {
					const options = commands.commands
						.filter((c) => (typeof c.key === 'string' ? c.key : c.key[0]).startsWith(commandName))
						.map((c): CommandAutocompleteOption => ({
							replaceValue: (typeof c.key === 'string' ? c.key : c.key[0]),
							displayValue: `!${(typeof c.key === 'string' ? c.key : c.key[0])}${c.usage ? ' ' + c.usage : ''}${c.description ? ' - ' + c.description : ''}`,
							longDescription: c.longDescription,
						}));

					return options.length > 0 ? {
						header: 'Custom Bot commands (arguments in <> are required, arguments in [] are optional)',
						options,
					} : null;
				} else if (commands.result === 'botError') {
					toast('The space\'s bot failed to produce command list', TOAST_OPTIONS_ERROR);
					return null;
				} else if (commands.result === 'botDisconnected') {
					toast('The space\'s bot is not currently available', TOAST_OPTIONS_ERROR);
					return null;
				} else if (commands.result === 'noBot') {
					toast('This space has no bot to send the command to', TOAST_OPTIONS_ERROR);
					return null;
				}
				AssertNever(commands);
			}

			const loadResult = await this._loadCommandStructure(commandName, rest, context);
			if (loadResult.is_err()) {
				// Failed to run autocomplete, but this is to be expected, just keep it silent
				return null;
			}
			const { structure, args, unparsedSuffix } = loadResult.value;
			const headerPrefix = `!${commandName} `;

			// Rest argument has no autocomplete
			if (structure.nextSegment === 'rest' || structure.nextSegment == null) {
				return {
					header: headerPrefix + structure.header,
					options: [],
				};
			} else {
				const { value, spacing: lastArgumentSpacing, rest: lastArgumentRest } = COMMAND_STEP_PREPARSE_PROCESSORS[structure.nextSegment.preparse](unparsedSuffix);
				Assert(!lastArgumentSpacing && !lastArgumentRest, 'Argument to autocomplete has followup');

				const options = BotInteractionsService._autocompleteNextArgumentTokenized(value, structure.nextSegment.process, context) ?? [];
				const isQuotedPreprocessor = structure.nextSegment.preparse === 'quotedArg' || structure.nextSegment.preparse === 'quotedArgTrimmed';
				const shouldQuote = isQuotedPreprocessor && options.some(({ replaceValue }) => CommandArgumentNeedsQuotes(replaceValue));

				return {
					header: headerPrefix + structure.header,
					options: options.map(({ replaceValue, ...optionProps }): CommandAutocompleteOption => ({
						...optionProps,
						replaceValue: commandName + ' ' + args.map((it) => it.normalizedInput + ' ').join('') + (shouldQuote ? CommandArgumentQuote(replaceValue, true) : replaceValue),
					})),
				};
			}
		} catch (err) {
			toast('Error while running command autocomplete', TOAST_OPTIONS_ERROR);
			this.logger.warning(`Error while autocompleting command ${input} against `, BotInteractionsService._getCurrentCacheKey(context), ':\n', err);
			return null;
		}
	}

	private _lastAutcomplete: {
		key: CommandCacheKey;
		lastQuery: string;
		lastResult: CommandAutocompleteResult;
		currentIndex: number | null;
	} | undefined;

	public async autocompleteCycle(input: string, reverse: boolean): Promise<AutocompleteDisplayData> {
		const { commandName } = BotInteractionsService._parseCommandName(input);
		const context = this._getCommandContext(commandName, 'autocomplete');
		if (context == null) {
			// Not ready to process bot commands
			return {
				replace: input,
				result: null,
				index: null,
				nextSegment: false,
			};
		}

		if (this._lastAutcomplete?.lastQuery === input &&
			this._lastAutcomplete.lastResult &&
			isEqual(this._lastAutcomplete.key, BotInteractionsService._getCurrentCacheKey(context))
		) {
			this._lastAutcomplete.currentIndex = reverse ?
				((this._lastAutcomplete.currentIndex ?? this._lastAutcomplete.lastResult.options.length) - 1 + this._lastAutcomplete.lastResult.options.length) % this._lastAutcomplete.lastResult.options.length :
				((this._lastAutcomplete.currentIndex ?? -1) + 1) % this._lastAutcomplete.lastResult.options.length;
			const replace = this._lastAutcomplete.lastResult.options[this._lastAutcomplete.currentIndex].replaceValue.trim();
			this._lastAutcomplete.lastQuery = replace;
			return {
				replace,
				result: this._lastAutcomplete.lastResult,
				index: this._lastAutcomplete.currentIndex,
				nextSegment: false,
			};
		}
		this._lastAutcomplete = undefined;
		const result = await this.autocomplete(input);
		if (!result || result.options.length === 0) {
			return {
				replace: input,
				result,
				index: null,
				nextSegment: false,
			};
		} else if (result.options.length === 1) {
			const replace = result.options[0].replaceValue + ' ';
			return {
				replace,
				result: await this.autocomplete(replace),
				index: null,
				nextSegment: true,
			};
		}
		const best = LongestCommonPrefix(result.options.map((i) => i.replaceValue));
		// Only use the prefix if it matches with the already entered value
		const bestReplacement = best.toLocaleLowerCase().startsWith(input.toLocaleLowerCase()) ? best : input;
		this._lastAutcomplete = {
			key: BotInteractionsService._getCurrentCacheKey(context),
			lastQuery: bestReplacement,
			lastResult: result,
			currentIndex: null,
		};
		return {
			replace: bestReplacement,
			result,
			index: null,
			nextSegment: false,
		};
	}

	public getChatStatus(_input: string): ChatCharacterFullStatus {
		// Bot commands do not support chat status
		return { status: 'none' };
	}

	private _commandStructureCache: CommandParsingCache | undefined;
	private async _loadCommandStructure(command: string, input: string, context: BotCommandContext): Promise<Result<{
		structure: BotCommandStructureResult;
		args: readonly CommandParsedArg[];
		unparsedSuffix: string;
	}, string>> {
		// Result
		const args: CommandParsedArg[] = [];

		// Try to handle things from the cache first
		const cacheKey = BotInteractionsService._getCurrentCacheKey(context);

		const originalInput = input;
		let allowRetry = false;
		if (this._commandStructureCache != null &&
			isEqual(this._commandStructureCache.key, cacheKey) &&
			this._commandStructureCache.command === command
		) {
			allowRetry = true; // If something breaks down the road, we can retry
			let cacheMatched = true;
			// First match existing arguments
			for (const { descriptor, parsedValue } of this._commandStructureCache.args) {
				// Pre-parse next argument
				const { value, spacing, rest } = COMMAND_STEP_PREPARSE_PROCESSORS[descriptor.preparse](input);
				const isQuotedPreprocessor = descriptor.preparse === 'quotedArg' || descriptor.preparse === 'quotedArgTrimmed';
				// If nothing follows, this is the last argument - this means the input got shorter than the cache, having moved to different argument
				// Break out of cache processing and allow a proper fetch to happen
				if (!rest && !spacing) {
					cacheMatched = false;
					break;
				}

				// Otherwise we continue
				const parsed = BotInteractionsService._parseNextArgumentTokenized(value, descriptor.process, context);
				if (parsed.is_err() || parsed.value !== parsedValue) {
					// Mismatch with the cache - break out and let this argument be processed properly
					cacheMatched = false;
					break;
				}

				args.push({
					normalizedInput: (isQuotedPreprocessor ? CommandArgumentQuote(value) : value),
					parsedValue: parsed.value,
					descriptor,
				});
				input = rest;
			}
			// If cached matched on all args, we can serve the next segment from it too
			if (cacheMatched) {
				const cachedStructure = this._commandStructureCache.result;

				// Check for end of chain: We managed to fully serve from cache
				if (cachedStructure.nextSegment === 'rest' || cachedStructure.nextSegment == null) {
					return Result.Ok({
						structure: cachedStructure,
						args,
						unparsedSuffix: input,
					});
				}

				// Pre-parse next argument
				const { value, spacing, rest } = COMMAND_STEP_PREPARSE_PROCESSORS[cachedStructure.nextSegment.preparse](input);
				const isQuotedPreprocessor = cachedStructure.nextSegment.preparse === 'quotedArg' || cachedStructure.nextSegment.preparse === 'quotedArgTrimmed';
				// If nothing follows, this is the last argument: We managed to fully serve from cache
				if (!rest && !spacing) {
					return Result.Ok({
						structure: cachedStructure,
						args,
						unparsedSuffix: input,
					});
				}

				// The user moved on to next argument comapred to the cache
				// Process this argument based on the cached structure and fall back to normal processing
				const parsed = BotInteractionsService._parseNextArgumentTokenized(value, cachedStructure.nextSegment.process, context);
				if (parsed.is_ok()) {
					args.push({
						normalizedInput: (isQuotedPreprocessor ? CommandArgumentQuote(value) : value),
						parsedValue: parsed.value,
						descriptor: cachedStructure.nextSegment,
					});
					input = rest;
				} else {
					// Failed to parse the newest argument using cache - do not update input, letting the normal flow re-fetch it
				}
			}
		}

		// Clear cache in case the below errors, avoiding cache-induced error loop
		this._commandStructureCache = undefined;

		let lastStructure: BotCommandStructureResult | undefined;
		while (true) {
			const nextStructureResult = await this._loadCommandStructureTokenized(command, args.map((it) => it.parsedValue));
			if (nextStructureResult.is_err())
				return nextStructureResult;
			const nextStructure = nextStructureResult.value;

			const currentStructure = args.map((it) => it.descriptor);
			if (!isEqual(nextStructure.arguments, currentStructure)) {
				if (allowRetry) {
					// Result is partially from cache, drop everything and re-do it from scratch
					allowRetry = false;
					input = originalInput;
					args.length = 0;
					lastStructure = undefined;
					continue;
				}
				return Result.Err(`Bot returned conflicting arguments structure while processing the command:\n${JSON.stringify(nextStructure.arguments, undefined, '    ')}\nvs\n${JSON.stringify(currentStructure, undefined, '    ')}`);
			}

			lastStructure = nextStructure;

			// Check of end of chain
			if (nextStructure.nextSegment === 'rest' || nextStructure.nextSegment == null)
				break;

			// Pre-parse next argument
			const { value, spacing, rest } = COMMAND_STEP_PREPARSE_PROCESSORS[nextStructure.nextSegment.preparse](input);
			const isQuotedPreprocessor = nextStructure.nextSegment.preparse === 'quotedArg' || nextStructure.nextSegment.preparse === 'quotedArgTrimmed';
			// If nothing follows, this is the last argument - do not process it, as it might not be complete based on context
			if (!rest && !spacing)
				break;

			// Otherwise we continue
			const parsed = BotInteractionsService._parseNextArgumentTokenized(value, nextStructure.nextSegment.process, context);
			if (parsed.is_err()) {
				// Save cache of what we have so far if parsing fails
				this._commandStructureCache = {
					key: cacheKey,
					command,
					args,
					result: lastStructure,
				};
				return parsed;
			}

			args.push({
				normalizedInput: (isQuotedPreprocessor ? CommandArgumentQuote(value) : value),
				parsedValue: parsed.value,
				descriptor: nextStructure.nextSegment,
			});
			input = rest;
		}

		// Cache the results
		this._commandStructureCache = {
			key: cacheKey,
			command,
			args,
			result: lastStructure,
		};

		return Result.Ok({
			structure: lastStructure,
			args,
			unparsedSuffix: input,
		});
	}

	private async _loadCommandStructureTokenized(command: string, args: readonly string[]): Promise<Result<BotCommandStructureResult, string>> {
		const result = await this.serviceDeps.shardConnector.awaitResponse('botCommandGetStructurePart', {
			command,
			args: args.slice(),
		});

		if (result.result === 'ok') {
			return Result.Ok(result);
		} else if (result.result === 'invalidCommand') {
			return Result.Err(`Unknown command '${command}'`);
		} else if (result.result === 'invalidArguments') {
			return Result.Err(`Error processing arguments: ${result.message}`);
		} else if (result.result === 'botError') {
			return Result.Err('The space\'s bot failed to process the command');
		} else if (result.result === 'botDisconnected') {
			return Result.Err('The space\'s bot is not currently available to process the command');
		} else if (result.result === 'noBot') {
			return Result.Err('This space has no bot to send the command to');
		}
		AssertNever(result);
	}

	private _getCommandContext(commandName: string, executionType: BotCommandContext['executionType']): BotCommandContext | null {
		const gameState = this.serviceDeps.gameState.gameState.value;
		if (gameState == null)
			return null;

		return {
			commandName,
			executionType,
			gameState,
			globalState: gameState.globalState.currentState,
		};
	}

	private static _getCurrentCacheKey(context: BotCommandContext): CommandCacheKey {
		const spaceInfo = context.gameState.currentSpace.value;

		return {
			space: spaceInfo.id,
			bot: spaceInfo.config.bot?.bot ?? null,
		};
	}

	private static _parseCommandName(input: string): { commandName: string; spacing: string; rest: string; } {
		let commandName: string = '';
		let spacing: string = '';
		const rest = input
			.trimStart()
			.replace(/[^\s]+/, (v) => {
				commandName = v.toLowerCase();
				return '';
			})
			.replace(/^\s+/, (v) => {
				spacing = v;
				return '';
			})
			.trimStart();

		return { commandName, spacing, rest };
	}

	private static _parseNextArgument(input: string, descriptor: BotCommandArgumentDescriptor, context: BotCommandContext): Result<{ parsed: string; spacing: string; rest: string; }, string> {
		const { value, spacing, rest } = COMMAND_STEP_PREPARSE_PROCESSORS[descriptor.preparse](input);

		return BotInteractionsService._parseNextArgumentTokenized(value, descriptor.process, context)
			.map((parsed) => ({ parsed, spacing, rest }));

	}

	private static _parseNextArgumentTokenized(value: string, processor: BotCommandArgumentProcessor, context: BotCommandContext): Result<string, string> {
		const result = BotInteractionsService._getArgumentProcessor(processor)
			.parse(value, context, {});

		if (result.success) {
			return Result.Ok(result.value);
		} else {
			return Result.Err(result.error);
		}
	}

	private static _autocompleteNextArgumentTokenized(input: string, processor: BotCommandArgumentProcessor, context: BotCommandContext): CommandAutocompleteOption[] | undefined {
		return BotInteractionsService._getArgumentProcessor(processor)
			.autocomplete?.(input, context, {});
	}

	private static _getArgumentProcessor(processor: BotCommandArgumentProcessor): CommandStepProcessor<string, BotCommandContext> {
		switch (processor.type) {
			case 'string':
				return CommandSelectorAnyQuotedString();

			case 'number': {
				const processorInstance = CommandSelectorNumber({
					min: processor.min,
					max: processor.max,
					allowDecimals: processor.allowDecimals,
				});

				// Serialize number after parsing
				return {
					...processorInstance,
					parse(input, context, args) {
						const result = processorInstance.parse(input, context, args);
						if (result.success) {
							return { success: true, value: result.value.toString(10) };
						}
						return result;
					},
					autocomplete: processorInstance.autocomplete?.bind(processorInstance),
				};
			}

			case 'enum':
				return CommandSelectorEnum(processor.options.map((it) => typeof it === 'string' ? it : !it.description ? it.value : [it.value, it.description] as const));

			case 'namedValue':
				return CommandSelectorNamedValue<string>(
					processor.options.map(({ name, description }) => ({ value: name, name, description })),
					processor.autocompleteShowValues,
				);

			case 'character': {
				const allowedCharacters = processor.allowedCharacters;
				const processorInstance = CommandSelectorCharacter({
					allowSelf: processor.allowSelf,
					filter: allowedCharacters != null ? (({ character }) => allowedCharacters.includes(character.id)) : undefined,
				});

				// Serialize number after parsing
				return {
					...processorInstance,
					parse(input, context, args) {
						const result = processorInstance.parse(input, context, args);
						if (result.success) {
							return { success: true, value: result.value.id };
						}
						return result;
					},
					autocomplete: processorInstance.autocomplete?.bind(processorInstance),
				};
			}

			case 'optional': {
				const processorInstance = CommandStepOptional(BotInteractionsService._getArgumentProcessor(processor.argument));

				// Serialize undefined as empty string
				return {
					...processorInstance,
					parse(input, context, args) {
						const result = processorInstance.parse(input, context, args);
						if (result.success) {
							return { success: true, value: result.value ?? '' };
						}
						return result;
					},
					autocomplete: processorInstance.autocomplete?.bind(processorInstance),
				};
			}
		}
	}

	//#endregion
}

type BotCommandContext = ICommandClientNeededContext<'gameState' | 'globalState'>;

interface CommandCacheKey {
	space: SpaceId | null;
	bot: BotId | null;
}

interface CommandParsedArg {
	normalizedInput: string;
	parsedValue: string;
	descriptor: BotCommandArgumentDescriptor;
}

interface CommandParsingCache {
	key: CommandCacheKey;
	command: string;
	args: readonly CommandParsedArg[];
	result: BotCommandStructureResult;
}

export const BotInteractionsServiceProvider: ServiceProviderDefinition<ClientGameLogicServices, 'botInteractions', BotInteractionsServiceConfig, ClientGameLogicServicesDependencies> = {
	name: 'botInteractions',
	ctor: BotInteractionsService,
	dependencies: {
		shardConnector: true,
		gameState: true,
	},
};
