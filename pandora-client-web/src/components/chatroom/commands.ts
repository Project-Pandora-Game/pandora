import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor';
import { ChatTypeDetails, CommandBuilder, CreateCommand, IChatType, IEmpty, LONGDESC_RAW, LONGDESC_THIRD_PERSON } from 'pandora-common';
import { CommandSelectorCharacter } from './commandsHelpers';
import { ChatMode } from './chatInput';

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
	{
		key: ['dice'],
		description: 'Roll up to 10 100-sided dice.',
		longDescription: `Without any options a single 6-sided die is rolled. The command '/dice 20' rolls a single 20-sided die and '/dice 3d6' rolls 3 6-sided dice. The option '/secret' hides the roll result from others in the room.`,
		usage: `([sides] | <count>d<sides>) [/secret]`,
		handler: CreateClientCommand()
			.argument('options', {
				preparse: 'allTrimmed',
				parse: (input) => {
					let dice = 1;
					let sides = 6;
					let hidden = false;
					input = input.toUpperCase();
					if (input.includes('/SECRET')) {
						hidden = true;
						input = input.replace('/SECRET', '').trim();
					}
					if (input !== '') {
						// Accept options like 100, 1d6, 1 d 6 or 1d 6. Also sides and dice can be omitted
						const match = input.match(/^(?:(\d+)\s*D)?\s*(\d+)$/i);
						if (match) {
							dice = match[1] ? parseInt(match[1]) : 1;
							sides = parseInt(match[2]);
							if (dice > 10 || sides > 100) {
								return { success: false, error: 'Maximum sides (100)/ dice (10) exceeded' };
							}
						} else {
							return { success: false, error: `Invalid Options: '${input}'` };
						} // RegEx test
					}
					return { success: true, value: { dice, sides, hidden } };
				},
			})
			.handler(({ shardConnector }, { options }) => {
				shardConnector.sendMessage('gamblingAction', {
					type: 'diceRoll',
					...options,
				});
				return true;
			}),
	},
];
