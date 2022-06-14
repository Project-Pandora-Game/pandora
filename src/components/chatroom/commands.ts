import { CharacterId, IChatRoomStatus, IChatType } from 'pandora-common';
import { Player } from '../../character/player';
import { Room } from '../../character/room';
import { ShardConnector } from '../../networking/shardConnector';
import { ChatParser } from './chatParser';
import { SentMessages } from './sentMessages';

export const COMMAND_KEY = '/';

type ICommandBase = {
	key: string[];
	description: string;
	usage: string;
	argCount: number;
};

type ICommandArgs = {
	args: string[];
	key: string;
	shardConnector: ShardConnector | null;
};

type ICommand = ICommandBase & ({
	requreMessage: true;
	handler: (args: ICommandArgs, message: string) => boolean;
	status?: { status: IChatRoomStatus; } | ((args: string[]) => { status: IChatRoomStatus; } | { status: IChatRoomStatus, target: CharacterId; });
} | {
	requreMessage: false;
	handler: (args: ICommandArgs) => boolean;
	status?: undefined;
});

const CreateMessageTypeParser = (name: string, type: IChatType): ICommand => ({
	key: [name, `raw${name}`],
	description: `Sends ${'aeiou'.includes(type[0]) ? 'an' : 'a'} ${type} message with or without format`,
	usage: '...message',
	argCount: 0,
	requreMessage: true,
	status: { status: 'typing' },
	handler: ({ key, shardConnector }: ICommandArgs, message: string): boolean => {
		message = message.trim();
		if (!message) {
			return false; // TODO: prevent chat clearing
		}

		return SentMessages.send(shardConnector, `${key} ${message}`, [{
			type,
			parts: key.startsWith('/raw') ? [['normal', message]] : ChatParser.parseStyle(message),
		}]);
	},
});

function GetWhisperTarget([character]: string[]): CharacterId | undefined {
	const playerId = Player.value?.data.id;
	const char = Room.data.value?.characters.find((c) => c.id === character);
	if (char)
		return char.id === playerId ? undefined : char.id;

	let chars = Room.data.value?.characters.filter((c) => c.name.localeCompare(character, undefined, { sensitivity: 'base' }) === 0) ?? [];
	if (chars.length === 1)
		return chars[0].id === playerId ? undefined : chars[0].id;
	if (chars.length === 0)
		return undefined;

	chars = chars.filter((c) => c.name === character);
	if (chars.length === 1)
		return chars[0].id === playerId ? undefined : chars[0].id;

	return undefined;
}

const COMMANDS: ICommand[] = [
	{
		key: ['w', 'whisper'],
		description: 'Send a private message to a user',
		usage: '[characterId] ...message',
		argCount: 1,
		requreMessage: true,
		status: (args) => {
			const target = GetWhisperTarget(args);
			return target ? { status: 'whisper', target } : { status: 'none' };
		},
		handler: ({ key, args, shardConnector }: ICommandArgs, message: string): boolean => {
			const target = GetWhisperTarget(args);
			if (!target)
				return false;

			return SentMessages.send(shardConnector, `${key} ${target} ${message}`, ChatParser.parse(message, target));
		},
	},
	CreateMessageTypeParser('say', 'chat'),
	CreateMessageTypeParser('ooc', 'ooc'),
	CreateMessageTypeParser('me', 'me'),
	CreateMessageTypeParser('emote', 'emote'),
];

export function GetCommand(message: string, predicate?: (command: ICommand) => boolean): boolean | ICommand {
	message = message.trimStart();
	if (!message.startsWith(COMMAND_KEY)) {
		return false;
	}
	if (message.startsWith(COMMAND_KEY + COMMAND_KEY)) {
		return true;
	}
	const [command] = message.split(/\s+/);
	const key = command.slice(COMMAND_KEY.length).toLowerCase();
	const commandMatch = COMMANDS.find((c) => c.key.includes(key));
	return commandMatch && (!predicate || predicate(commandMatch)) ? commandMatch : true;
}

export function ParseCommands(shardConnector: ShardConnector, text: string): string | boolean {
	text = text.trimStart();
	if (!text.startsWith(COMMAND_KEY)) {
		return text;
	}
	if (text.startsWith(COMMAND_KEY + COMMAND_KEY)) {
		return text.substring(COMMAND_KEY.length);
	}
	const [command, ...args] = text.split(/\s+/);
	if (args.length > 0) {
		const commandInfo = COMMANDS.find((c) => c.key.includes(command.substring(COMMAND_KEY.length)));
		if (!commandInfo) {
			return false; // TODO: error message
		}
		if (commandInfo.requreMessage ? args.length <= commandInfo.argCount : args.length !== commandInfo.argCount) {
			return false; // TODO: error message
		}
		if (!commandInfo.requreMessage) {
			return commandInfo.handler({ args, key: command, shardConnector });
		}
		let message = text.substring(command.length).trimStart();
		for (let i = 0; i < commandInfo.argCount; i++) {
			message = message.substring(args[i].length).trimStart();
		}

		return commandInfo.handler({ args, key: command, shardConnector }, message);
	}
	// TODO auto complete, error messages
	return text;
}

