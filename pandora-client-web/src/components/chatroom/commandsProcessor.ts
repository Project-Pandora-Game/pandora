import { CommandAutocompleteResult, CommandRunner, ICommandExecutionContext, IEmpty, LongestCommonPrefix } from 'pandora-common';
import type { ShardConnector } from '../../networking/shardConnector';
import type { ChatRoom, IChatRoomMessageSender } from '../gameContext/chatRoomContextProvider';
import type { IChatInputHandler } from './chatInput';
import { COMMANDS } from './commands';

export const COMMAND_KEY = '/';

export interface ICommandExecutionContextClient extends ICommandExecutionContext {
	shardConnector: ShardConnector;
	chatRoom: ChatRoom;
	messageSender: IChatRoomMessageSender;
	inputHandlerContext: IChatInputHandler;
}

export type IClientCommand = {
	key: [string, ...string[]];
	description: string;
	longDescription: string;
	usage: string;
	handler: CommandRunner<ICommandExecutionContextClient, IEmpty>;
	// TODO
	// status?: { status: IChatRoomStatus; } | ((args: string[]) => { status: IChatRoomStatus; } | { status: IChatRoomStatus, target: CharacterId; });
};

export function GetCommand(input: string): {
	commandName: string;
	spacing: string;
	args: string;
	command: IClientCommand | null;
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

	const command = COMMANDS.find((c) => c.key.includes(commandName)) ?? null;

	return {
		commandName,
		spacing,
		args: input,
		command,
	};
}

export function RunCommand(originalInput: string, ctx: Omit<ICommandExecutionContextClient, 'executionType' | 'commandName'>): boolean {
	const { commandName, command, args } = GetCommand(originalInput);

	if (!command) {
		ctx.displayError?.(`Unknown command '${commandName}'`);
		return false;
	}

	const context: ICommandExecutionContextClient = {
		...ctx,
		executionType: 'run',
		commandName,
	};

	return command.handler.run(context, {}, args);
}

export function CommandAutocomplete(msg: string, ctx: Omit<ICommandExecutionContextClient, 'executionType' | 'commandName'>): CommandAutocompleteResult {
	const { commandName, spacing, command, args } = GetCommand(msg);

	// If there is no space after commandName, we are autocompleting the command itself
	if (!spacing) {
		const options = COMMANDS
			.filter((c) => c.key[0].startsWith(commandName))
			.map((c) => ({
				replaceValue: c.key[0],
				displayValue: `/${c.key[0]}${c.usage ? ' ' + c.usage : ''} - ${c.description}`,
				longDescription: c.longDescription,
			}));
		return options.length > 0 ? {
			header: 'Commands (arguments in <> are required, arguments in [] are optional)',
			options,
		} : null;
	}

	const context: ICommandExecutionContextClient = {
		...ctx,
		executionType: 'autocomplete',
		commandName,
	};

	if (command) {
		const autocompleteResult = command.handler.autocomplete(context, {}, args);

		return autocompleteResult != null ? {
			header: `/${commandName} ${autocompleteResult.header}`,
			options: autocompleteResult.options.map(({ replaceValue, displayValue }) => ({
				replaceValue: commandName + ' ' + replaceValue,
				displayValue,
			})),
		} : null;
	}

	return null;
}

export interface AutocompleteDisplyData {
	result: CommandAutocompleteResult;
	replace: string;
	index: number | null;
}

let autocompleteLastQuery: string | null = null;
let autocompleteLastResult: CommandAutocompleteResult = null;
let autocompleteNextIndex = 0;

export function CommandAutocompleteCycle(msg: string, ctx: Omit<ICommandExecutionContextClient, 'executionType' | 'commandName'>): AutocompleteDisplyData {
	if (autocompleteLastQuery === msg && autocompleteLastResult && autocompleteNextIndex < autocompleteLastResult.options.length) {
		const index = autocompleteNextIndex;
		const replace = autocompleteLastResult.options[index].replaceValue.trim();
		autocompleteNextIndex = (autocompleteNextIndex + 1) % autocompleteLastResult.options.length;
		autocompleteLastQuery = replace;
		return {
			replace,
			result: autocompleteLastResult,
			index,
		};
	}
	autocompleteLastQuery = null;
	autocompleteLastResult = CommandAutocomplete(msg, ctx);
	if (!autocompleteLastResult || autocompleteLastResult.options.length === 0) {
		return {
			replace: msg,
			result: null,
			index: null,
		};
	} else if (autocompleteLastResult.options.length === 1) {
		return {
			replace: autocompleteLastResult.options[0].replaceValue + ' ',
			result: CommandAutocomplete(autocompleteLastResult.options[0].replaceValue + ' ', ctx),
			index: null,
		};
	}
	const best = LongestCommonPrefix(autocompleteLastResult.options.map((i) => i.replaceValue));
	autocompleteLastQuery = best;
	autocompleteNextIndex = 0;
	return {
		replace: best,
		result: autocompleteLastResult,
		index: null,
	};
}
