import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor';
import { CommandBuilder, CreateCommand, IChatType, IEmpty } from 'pandora-common';
import { CommandSelectorCharacter } from './commandsHelpers';

function CreateClientCommand(): CommandBuilder<ICommandExecutionContextClient, IEmpty, IEmpty> {
	return CreateCommand<ICommandExecutionContextClient>();
}

const CreateMessageTypeParser = (names: string[], raw: boolean, type: IChatType, description: string): IClientCommand => {
	const desc = `${description}${raw ? ', without any formatting' : ''}`;
	return ({
		key: names.map((name) => (raw ? 'raw' : '') + name),
		description: `Sends ${'aeiou'.includes(desc[0]) ? 'an' : 'a'} ${desc}`,
		usage: '[message]',
		// TODO
		// status: { status: 'typing' },
		handler: CreateClientCommand()
			.handler(({ messageSender, displayError }, _args, message) => {
				message = message.trim();

				if (!message) {
					displayError?.(`Cannot send empty message`);
					return false;

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
const CreateMessageTypeParsers = (names: string[], type: IChatType, description: string): IClientCommand[] => [
	CreateMessageTypeParser(names, false, type, description), //formatted
	CreateMessageTypeParser([names[0]], true, type, description), //raw, no alternatives
];

export const COMMANDS: readonly IClientCommand[] = [
	...CreateMessageTypeParsers(['say', 'chat'], 'chat', 'standard message'),
	...CreateMessageTypeParsers(['ooc', 'o'], 'ooc', 'out-of-character (OOC) message'),
	...CreateMessageTypeParsers(['me', 'm', 'action'], 'me', 'action message'),
	...CreateMessageTypeParsers(['emote', 'e'], 'emote', 'action message without your name'),
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
