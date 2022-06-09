import { IChatType } from 'pandora-common';
import { Player } from '../../character/player';
import { Room } from '../../character/room';
import { ShardConnector } from '../../networking/socketio_shard_connector';
import { ChatParser } from './chatParser';

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
};

type ICommand = ICommandBase & ({
	requreMessage: true;
	handler: (args: ICommandArgs, message: string) => boolean;
} | {
	requreMessage: false;
	handler: (args: ICommandArgs) => boolean;
});

const CreateMessageTypeParser = (name: string, type: IChatType): ICommand => ({
	key: [name, `raw${name}`],
	description: `Sends ${'aeiou'.includes(type[0]) ? 'an' : 'a'} ${type} message with or without format`,
	usage: '...message',
	argCount: 0,
	requreMessage: true,
	handler: ({ key }: ICommandArgs, message: string): boolean => {
		message = message.trim();
		if (!ShardConnector.value || !message) {
			return false; // TODO: prevent chat clearing
		}

		ShardConnector.value.sendMessage('chatRoomMessage', {
			messages: [{
				type,
				parts: key.startsWith('/raw') ? [['normal', message]] : ChatParser.parseStyle(message),
			}],
		});

		return true;
	},
});

const COMMANDS: ICommand[] = [
	{
		key: ['w', 'whisper'],
		description: 'Send a private message to a user',
		usage: '[characterId] ...message',
		argCount: 1,
		requreMessage: true,
		handler: ({ args }: ICommandArgs, message: string): boolean => {
			if (!ShardConnector.value) {
				return false; // TODO: prevent chat clearing
			}

			const [character] = args;
			let char = Room.data.value?.characters.find((c) => c.id === character);
			if (!char) {
				const chars = Room.data.value?.characters.filter((c) => c.name === character) ?? [];
				if (chars.length === 1) {
					char = chars[0];
				} else {
					return false; // TODO: error message
				}
			}

			if (char.id === Player.value?.data.id) {
				return false; // TODO: error message
			}

			const messages = ChatParser.parse(message, char.id);

			if (messages.length === 0) {
				return false; // TODO: prevent chat clearing
			}

			ShardConnector.value.sendMessage('chatRoomMessage', { messages });
			return true;
		},
	},
	CreateMessageTypeParser('say', 'chat'),
	CreateMessageTypeParser('ooc', 'ooc'),
	CreateMessageTypeParser('me', 'me'),
	CreateMessageTypeParser('emote', 'emote'),
];

export function ParseCommands(text: string): string | boolean {
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
			return commandInfo.handler({ args, key: command });
		}
		let message = text.substring(command.length).trimStart();
		for (let i = 0; i < commandInfo.argCount; i++) {
			message = message.substring(args[i].length).trimStart();
		}

		return commandInfo.handler({ args, key: command }, message);
	}
	// TODO auto complete, error messages
	return text;
}

