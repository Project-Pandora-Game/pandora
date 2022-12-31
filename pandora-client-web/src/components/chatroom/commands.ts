import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor';
import { ChatTypeDetails, CommandBuilder, CreateCommand, IChatType, IEmpty, LONGDESC_RAW, LONGDESC_THIRD_PERSON } from 'pandora-common';
import { CommandSelectorCharacter } from './commandsHelpers';
import { ChatMode } from './chatInput';
import { CharacterView } from 'pandora-common';

function CreateClientCommand(): CommandBuilder<ICommandExecutionContextClient, IEmpty, IEmpty> {
	return CreateCommand<ICommandExecutionContextClient>();
}

const CreateMessageTypeParser = (names: [string, ...string[]], raw: boolean, type: IChatType, longDescription: string): IClientCommand => {
	const description = GetChatModeDescription({ type, raw });
	return ({
		key: names.map((name) => (raw ? 'raw' : '') + name) as [string, ...string[]],
		description: `Sends ${'aeiou'.includes(description[0]) ? 'an' : 'a'} ${description}`,
		longDescription,
		usage: '[message]',
		// TODO
		// status: { status: 'typing' },
		handler: CreateClientCommand()
			.handler({ restArgName: 'message' }, ({ messageSender, inputHandlerContext }, _args, message) => {
				message = message.trim();

				if (!message) {
					if (inputHandlerContext.mode?.type === type && inputHandlerContext.mode?.raw === raw) {
						inputHandlerContext.setMode(null);
						return true;
					}

					inputHandlerContext.setMode({ type, raw });
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

const BuildAlternativeCommandsMessage = (keywords: string[]): string => {
	let result = '';
	if (keywords.length > 1) {
		result = `Alternative command${keywords.length > 2 ? 's' : ''}: `;
		result += keywords.slice(1).map((command, index, array) => {
			const isLast = index === array.length - 1;
			return `/${command}${isLast ? '' : ', '}`;
		}).join('');
		result += `. `;
	}
	return result;
};

export function GetChatModeDescription(mode: ChatMode, plural: boolean = false) {
	const description = ChatTypeDetails[mode.type]?.description;
	if (description) {
		const desc = `${description}${mode.raw ? ', without any formatting' : ''}`;
		return plural ? desc.replace('message', 'messages') : desc;
	}
	return '';
}

/* Creates two commands for sending chat messages of a specific type, one formatted and one raw/unformatted */
const CreateMessageTypeParsers = (type: IChatType): IClientCommand[] => {
	const details = ChatTypeDetails[type];
	const longDesc = `${BuildAlternativeCommandsMessage(details.commandKeywords)}${details.longDescription}`;
	return [
		CreateMessageTypeParser(details.commandKeywords, false, type, longDesc), //formatted
		CreateMessageTypeParser([details.commandKeywords[0]], true, type, details.longDescription + LONGDESC_RAW), //raw, no alternatives
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
		longDescription: 'Sends a message to the selected <target> character which only they will see.' + LONGDESC_THIRD_PERSON,
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
		key: ['turn', 't'],
		description: 'Turns yourself around',
		longDescription: '',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ shardConnector }) => {
				const target = shardConnector.player.value;
				if (target) {
					shardConnector.sendMessage('appearanceAction', {
						type: 'setView',
						target: target.data.id,
						view: target.appearance.getView() === CharacterView.FRONT ? CharacterView.BACK : CharacterView.FRONT,
					});
					return true;
				} else {
					return false;
				}
			}),
	},
	{
		key: ['coinflip'],
		description: 'Flip a coin with the result \'heads\' or \'tails\'',
		longDescription: '',
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
