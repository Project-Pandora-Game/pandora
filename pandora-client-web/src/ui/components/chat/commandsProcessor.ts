import type { Immutable } from 'immer';
import {
	CommandAutocompleteResult,
	CommandRunner,
	ICommandExecutionContext,
	IEmpty,
	LongestCommonPrefix,
	type AccountSettings,
	type AssetFrameworkGlobalState,
	type CharacterSettings,
	type ChatCharacterFullStatus,
	type CommandAutocompleteOption,
} from 'pandora-common';
import type { Promisable } from 'type-fest';
import type { PlayerCharacter } from '../../../character/player.ts';
import type { GameState, IChatMessageSender } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { DirectoryConnector } from '../../../networking/directoryConnector.ts';
import type { ShardConnector } from '../../../networking/shardConnector.ts';
import type { NavigateFunctionPandora } from '../../../routing/navigate.ts';
import type { AccountManager } from '../../../services/accountLogic/accountManager.ts';
import type { IChatInputHandler } from './chatInput.tsx';

export const COMMAND_KEY = '/';

export interface ICommandExecutionContextClient extends ICommandExecutionContext {
	shardConnector: ShardConnector;
	directoryConnector: DirectoryConnector;
	accountManager: AccountManager;
	gameState: GameState;
	globalState: AssetFrameworkGlobalState;
	player: PlayerCharacter;
	accountSettings: Immutable<AccountSettings>;
	characterSettings: Immutable<CharacterSettings>;
	messageSender: IChatMessageSender;
	inputHandlerContext: IChatInputHandler;
	navigate: NavigateFunctionPandora;
}

export type IClientCommand<TCommandExecutionContext extends ICommandExecutionContext> = {
	key: [string, ...string[]];
	description: string;
	longDescription: string;
	usage: string;
	handler: CommandRunner<TCommandExecutionContext, IEmpty>;
};

export function GetCommand<TCommandExecutionContext extends ICommandExecutionContext>(input: string, commands: readonly IClientCommand<TCommandExecutionContext>[]): {
	commandName: string;
	spacing: string;
	args: string;
	command: IClientCommand<TCommandExecutionContext> | null;
} {
	let commandName: string = '';
	let spacing: string = '';
	input = input
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

	const command = commands.find((c) => c.key.includes(commandName)) ?? null;

	return {
		commandName,
		spacing,
		args: input,
		command,
	};
}

export type ICommandInvokeContext<TCommandExecutionContext extends ICommandExecutionContext> = Omit<TCommandExecutionContext, 'executionType' | 'commandName'>;

function CreateContext<TCommandExecutionContext extends ICommandExecutionContext>(ctx: ICommandInvokeContext<TCommandExecutionContext>, executionType: ICommandExecutionContext['executionType'], commandName: string): TCommandExecutionContext {
	// @ts-expect-error - We are creating a new object here
	return {
		...ctx,
		executionType,
		commandName,
	};
}

export function RunCommand<TCommandExecutionContext extends ICommandExecutionContext>(
	originalInput: string,
	ctx: ICommandInvokeContext<TCommandExecutionContext>,
	commands: readonly IClientCommand<TCommandExecutionContext>[],
): Promisable<boolean> {
	const { commandName, command, args } = GetCommand(originalInput, commands);

	if (!command) {
		ctx.displayError?.(`Unknown command '${commandName}'`);
		return false;
	}

	const context = CreateContext(ctx, 'run', commandName);
	return command.handler.run(context, {}, args);
}

export function CommandAutocomplete<TCommandExecutionContext extends ICommandExecutionContext>(msg: string, ctx: ICommandInvokeContext<TCommandExecutionContext>, commands: readonly IClientCommand<TCommandExecutionContext>[]): CommandAutocompleteResult {
	const { commandName, spacing, command, args } = GetCommand(msg, commands);

	const context = CreateContext(ctx, 'autocomplete', commandName);

	// If there is no space after commandName, we are autocompleting the command itself
	if (!spacing) {
		const options = commands
			.filter((c) => c.key[0].startsWith(commandName))
			.map((c): CommandAutocompleteOption => ({
				replaceValue: c.key[0],
				displayValue: `/${c.key[0]}${c.usage ? ' ' + c.usage : ''} - ${c.description}`,
				longDescription: c.longDescription,
			}));
		return options.length > 0 ? {
			header: 'Commands (arguments in <> are required, arguments in [] are optional)',
			options,
		} : null;
	}

	if (command) {
		const autocompleteResult = command.handler.autocomplete(context, {}, args);

		return autocompleteResult != null ? {
			header: `/${commandName} ${autocompleteResult.header}`,
			options: autocompleteResult.options.map(({ replaceValue, ...optionProps }) => ({
				...optionProps,
				replaceValue: commandName + ' ' + replaceValue,
			})),
		} : null;
	}

	return null;
}

export function CommandGetChatStatus<TCommandExecutionContext extends ICommandExecutionContext>(
	originalInput: string,
	ctx: ICommandInvokeContext<TCommandExecutionContext>,
	commands: readonly IClientCommand<TCommandExecutionContext>[],
): ChatCharacterFullStatus {
	const { commandName, command, args } = GetCommand(originalInput, commands);

	if (!command) {
		return { status: 'none' };
	}

	const context = CreateContext(ctx, 'chatstatus', commandName);
	return command.handler.getChatStatus(context, {}, args) ?? { status: 'none' };
}

export interface AutocompleteDisplayData {
	result: CommandAutocompleteResult;
	replace: string;
	index: number | null;
	/**
	 * Whether the autocompletion result is for a different segment than the message requested it for.
	 * This happens when the current segment was completed fully and the completion moved to the next argument
	 */
	nextSegment: boolean;
}

let autocompleteLastQuery: string | null = null;
let autocompleteLastResult: CommandAutocompleteResult = null;
let autocompleteCurrentIndex: number | null = null;

export function CommandAutocompleteCycle<TCommandExecutionContext extends ICommandExecutionContext>(msg: string, ctx: ICommandInvokeContext<TCommandExecutionContext>, commands: readonly IClientCommand<TCommandExecutionContext>[], reverse: boolean = false): AutocompleteDisplayData {
	if (autocompleteLastQuery === msg && autocompleteLastResult) {
		autocompleteCurrentIndex = reverse ?
			((autocompleteCurrentIndex ?? autocompleteLastResult.options.length) - 1 + autocompleteLastResult.options.length) % autocompleteLastResult.options.length :
			((autocompleteCurrentIndex ?? -1) + 1) % autocompleteLastResult.options.length;
		const replace = autocompleteLastResult.options[autocompleteCurrentIndex].replaceValue.trim();
		autocompleteLastQuery = replace;
		return {
			replace,
			result: autocompleteLastResult,
			index: autocompleteCurrentIndex,
			nextSegment: false,
		};
	}
	autocompleteLastQuery = null;
	autocompleteLastResult = CommandAutocomplete(msg, ctx, commands);
	if (!autocompleteLastResult || autocompleteLastResult.options.length === 0) {
		return {
			replace: msg,
			result: autocompleteLastResult,
			index: null,
			nextSegment: false,
		};
	} else if (autocompleteLastResult.options.length === 1) {
		const replace = autocompleteLastResult.options[0].replaceValue + ' ';
		return {
			replace,
			result: CommandAutocomplete(replace, ctx, commands),
			index: null,
			nextSegment: true,
		};
	}
	const best = LongestCommonPrefix(autocompleteLastResult.options.map((i) => i.replaceValue));
	// Only use the prefix if it matches with the already entered value
	const bestReplacement = best.toLocaleLowerCase().startsWith(msg.toLocaleLowerCase()) ? best : msg;
	autocompleteLastQuery = bestReplacement;
	autocompleteCurrentIndex = null;
	return {
		replace: bestReplacement,
		result: autocompleteLastResult,
		index: null,
		nextSegment: false,
	};
}
