import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor';
import { ChatTypeDetails, CommandBuilder, CreateCommand, IChatType, IEmpty } from 'pandora-common';
import { CommandSelectorCharacter } from './commandsHelpers';

function CreateClientCommand(): CommandBuilder<ICommandExecutionContextClient, IEmpty, IEmpty> {
	return CreateCommand<ICommandExecutionContextClient>();
}

const CreateMessageTypeParser = (names: string[], raw: boolean, type: IChatType, description: string): IClientCommand => {
	const desc = `${description}${raw ? ', without any formatting' : ''}`;
	return ({
		key: names.map((name) => (raw ? 'raw' : '') + name) as [string, ...string[]],
		description: `Sends ${'aeiou'.includes(desc[0]) ? 'an' : 'a'} ${desc}`,
		usage: '[message]',
		// TODO
		// status: { status: 'typing' },
		handler: CreateClientCommand()
			.handler(({ messageSender, inputHandlerContext }, _args, message) => {
				message = message.trim();

				if (!message) {
					if (inputHandlerContext.mode?.type === type && inputHandlerContext.mode?.raw === raw) {
						inputHandlerContext.setMode(null);
						return true;
					}

					inputHandlerContext.setMode({
						type, raw,
						description: `Sending ${desc.replace('message', 'messages')}`,
					});
					return true;
				}

				messageSender.sendMessage(message, {
					type,
					raw: raw ? true : undefined,
				});

				return true;
			}),
	});
};

/* Creates two commands for sending chat messages of a specific type, one formatted and one raw/unformatted */
const CreateMessageTypeParsers = (type: IChatType): IClientCommand[] => {
	const details = ChatTypeDetails[type];
	return [
		CreateMessageTypeParser(details.commandKeywords, false, type, details.description), //formatted
		CreateMessageTypeParser([details.commandKeywords[0]], true, type, details.description), //raw, no alternatives
	];
};

export const COMMANDS: readonly IClientCommand[] = [
	...CreateMessageTypeParsers('chat'),
	...CreateMessageTypeParsers('ooc'),
	...CreateMessageTypeParsers('me'),
	...CreateMessageTypeParsers('emote'),
	{
		key: ['whisper', 'w'],
		description: 'Sends a private message to a user',
		usage: '<target> [message]',
		handler: CreateClientCommand()
			.argument('target', CommandSelectorCharacter({ allowSelf: false }))
			.handler({ restArgName: 'message' }, ({ messageSender, inputHandlerContext }, { target }, message) => {
				message = message.trim();
				if (!message) {
					inputHandlerContext.setTarget(target.data.id);
					return true;
				}

				messageSender.sendMessage(message, {
					target: target.data.id,
				});

				return true;
			}),
		// TODO
		// status: () => {
		// 	const target = undefined; // GetWhisperTarget(args);
		// 	return target ? { status: 'whisper', target } : { status: 'none' };
		// },
	},
];
