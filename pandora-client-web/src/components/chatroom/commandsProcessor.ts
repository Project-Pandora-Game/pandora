import { CommandRunner, ICommandExecutionContext, IEmpty, LongestCommonPrefix } from 'pandora-common';
import type { ShardConnector } from '../../networking/shardConnector';
import type { ChatRoom, IChatRoomMessageSender } from '../gameContext/chatRoomContextProvider';
import { COMMANDS } from './commands';

export const COMMAND_KEY = '/';

export interface ICommandExecutionContextClient extends ICommandExecutionContext {
	shardConnector: ShardConnector;
	chatRoom: ChatRoom;
	messageSender: IChatRoomMessageSender;
}

export type IClientCommand = {
	key: [string, ...string[]];
	description: string;
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

function CommandAutocomplete(msg: string, ctx: Omit<ICommandExecutionContextClient, 'executionType' | 'commandName'>): [string, string][] {
	const { commandName, spacing, command, args } = GetCommand(msg);

	// If there is no space after commandName, we are autocompleting the command itself
	if (!spacing) {
		return COMMANDS
			.filter((c) => c.key[0].startsWith(commandName))
			.map((c) => [c.key[0], `${c.key[0]}${c.usage ? ' ' + c.usage : ''} - ${c.description}`]);
	}

	const context: ICommandExecutionContextClient = {
		...ctx,
		executionType: 'autocomplete',
		commandName,
	};

	if (command) {
		return command.handler
			.autocomplete(context, {}, args)
			.map(({ replaceValue, displayValue }) => [
				commandName + ' ' + replaceValue,
				displayValue,
			]);
	}

	return [];
}

export interface AutocompleteDisplyData {
	result: string;
	options: [string, string][];
	index: number | null;
}

let autocompleteLastQuery: string | null = null;
let autocompleteLastResult: [string, string][] = [];
let autocompleteNextIndex = 0;

export function CommandAutocompleteCycle(msg: string, ctx: Omit<ICommandExecutionContextClient, 'executionType' | 'commandName'>): AutocompleteDisplyData {
	if (autocompleteLastQuery === msg && autocompleteNextIndex < autocompleteLastResult.length) {
		const index = autocompleteNextIndex;
		const result = autocompleteLastResult[index][0].trim();
		autocompleteNextIndex = (autocompleteNextIndex + 1) % autocompleteLastResult.length;
		autocompleteLastQuery = result;
		return {
			result,
			options: autocompleteLastResult,
			index,
		};
	}
	autocompleteLastQuery = null;
	autocompleteLastResult = CommandAutocomplete(msg, ctx);
	if (autocompleteLastResult.length === 0) {
		return {
			result: msg,
			options: [],
			index: null,
		};
	} else if (autocompleteLastResult.length === 1) {
		return {
			result: autocompleteLastResult[0][0] + ' ',
			options: [],
			index: null,
		};
	}
	const best = LongestCommonPrefix(autocompleteLastResult.map((i) => i[0]));
	autocompleteLastQuery = best;
	autocompleteNextIndex = 0;
	return {
		result: best,
		options: autocompleteLastResult,
		index: null,
	};
}
