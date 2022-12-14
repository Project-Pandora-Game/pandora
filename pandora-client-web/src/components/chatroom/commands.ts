import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor';
import { CommandBuilder, CreateCommand, IChatType, IEmpty } from 'pandora-common';
import { CommandSelectorCharacter } from './commandsHelpers';

function CreateClientCommand(): CommandBuilder<ICommandExecutionContextClient, IEmpty, IEmpty> {
	return CreateCommand<ICommandExecutionContextClient>();
}

const CreateMessageTypeParser = (name: string, type: IChatType): IClientCommand => ({
	key: [name],
	description: `Sends ${'aeiou'.includes(type[0]) ? 'an' : 'a'} ${type} message${name.startsWith('raw') ? ' without any formatting' : ''}`,
	usage: '<message>',
	// TODO
	// status: { status: 'typing' },
	handler: CreateClientCommand()
		.handler(({ commandName, messageSender, displayError }, _args, message) => {
			message = message.trim();
			if (!message) {
				displayError?.(`Cannot send empty message`);
				return false;
			}

			messageSender.sendMessage(message, {
				type,
				raw: commandName.startsWith('raw') || undefined,
			});

			return true;
		}),
});

export const COMMANDS: readonly IClientCommand[] = [
	CreateMessageTypeParser('say', 'chat'),
	CreateMessageTypeParser('raw' + 'say', 'chat'),
	CreateMessageTypeParser('ooc', 'ooc'),
	CreateMessageTypeParser('raw' + 'ooc', 'ooc'),
	CreateMessageTypeParser('me', 'me'),
	CreateMessageTypeParser('raw' + 'me', 'me'),
	CreateMessageTypeParser('emote', 'emote'),
	CreateMessageTypeParser('raw' + 'emote', 'emote'),
	{
		key: ['whisper', 'w'],
		description: 'Send a private message to a user',
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
	{
		key: ['coinflip'],
		description: 'Flip a coin with the result \'heads\' or \'tails\'',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ shardConnector }) => {
				shardConnector.sendMessage('gamblingAction', {
					type: 'coinFlip',
				});
				return true;
			}),
	},
];
