import { capitalize } from 'lodash-es';
import { AccountId, AccountIdSchema, AssertNever, ChatTypeDetails, CommandBuilder, CommandSelectorEnum, CommandStepOptional, CommandStepProcessor, CreateCommand, FilterItemType, IChatType, IClientDirectoryArgument, IEmpty, LONGDESC_RAW, LONGDESC_THIRD_PERSON, LONGDESC_TOGGLE_MODE } from 'pandora-common';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed.js';
import { toast } from 'react-toastify';
import { IsSpaceAdmin } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { OpenRoomItemDialog } from '../../screens/room/roomItemDialogList.ts';
import { ChatMode } from './chatInput.tsx';
import { CommandSelectorCharacter, CommandSelectorGameLogicActionTarget, CommandSelectorItem } from './commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from './commandsProcessor.ts';

function CreateClientCommand(): CommandBuilder<ICommandExecutionContextClient, IEmpty, IEmpty> {
	return CreateCommand<ICommandExecutionContextClient>();
}

function CreateMessageTypeParser(names: [string, ...string[]], raw: boolean, type: IChatType, longDescription: string, allowModeSet: boolean = true): IClientCommand<ICommandExecutionContextClient> {
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
					if (!allowModeSet)
						return false;

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
}

function BuildAlternativeCommandsMessage(keywords: string[]): string {
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
}

export function GetChatModeDescription(mode: ChatMode, plural: boolean = false) {
	const description = ChatTypeDetails[mode.type]?.description;
	if (description) {
		const desc = `${description}${mode.raw ? ', without any formatting' : ''}`;
		return plural ? desc.replace('message', 'messages') : desc;
	}
	return '';
}

/* Creates two commands for sending chat messages of a specific type, one formatted and one raw/unformatted */
function CreateMessageTypeParsers(type: IChatType, allowFormattedMode: boolean = true): IClientCommand<ICommandExecutionContextClient>[] {
	const details = ChatTypeDetails[type];
	const longDesc = `${BuildAlternativeCommandsMessage(details.commandKeywords)}${details.longDescription}`;
	return [
		CreateMessageTypeParser(details.commandKeywords, false, type, longDesc, allowFormattedMode), //formatted
		CreateMessageTypeParser([details.commandKeywords[0]], true, type, details.longDescription + (allowFormattedMode ? '' : LONGDESC_TOGGLE_MODE) + LONGDESC_RAW), //raw, no alternatives
	];
}

function CreateSpaceAdminAction(action: IClientDirectoryArgument['spaceAdminAction']['action'], longDescription: string): IClientCommand<ICommandExecutionContextClient> {
	return {
		key: [action],
		usage: '<target>',
		description: `${capitalize(action)} user`,
		longDescription,
		handler: CreateClientCommand()
			// TODO make this accept multiple targets and accountIds
			.argument('target', CommandSelectorCharacter({ allowSelf: 'none' }))
			.handler(({ gameState, directoryConnector, accountManager }, { target }) => {
				if (!IsSpaceAdmin(gameState.currentSpace.value.config, accountManager.currentAccount.value))
					return;

				if (['kick', 'ban'].includes(action) && IsSpaceAdmin(gameState.currentSpace.value.config, { id: target.data.accountId })) {
					toast('You cannot kick or ban an admin.', TOAST_OPTIONS_WARNING);
					return;
				}

				directoryConnector.sendMessage('spaceAdminAction', {
					action,
					targets: [target.data.accountId],
				});
			}),
	};
}

const ACCOUNT_ID_PARSER: CommandStepProcessor<AccountId, ICommandExecutionContextClient> = {
	preparse: 'allTrimmed',
	parse: (input, { accountManager }) => {
		const number = parseInt(input);
		const result = AccountIdSchema.safeParse(number);
		if (!result.success)
			return { success: false, error: 'Invalid account id' };
		if (accountManager.currentAccount.value?.id === result.data)
			return { success: false, error: 'You cannot use this command on yourself' };

		return { success: true, value: result.data };
	},
};

export const COMMANDS: readonly IClientCommand<ICommandExecutionContextClient>[] = [
	...CreateMessageTypeParsers('chat', false),
	...CreateMessageTypeParsers('ooc'),
	...CreateMessageTypeParsers('me'),
	...CreateMessageTypeParsers('emote'),
	CreateSpaceAdminAction('kick', 'Kicks a user from the current space.'),
	CreateSpaceAdminAction('ban', 'Bans a user from the current space.'),
	CreateSpaceAdminAction('allow', 'Add a user to the allow list of the current space.'),
	CreateSpaceAdminAction('disallow', 'Remove a user from the allow list of the current space.'),
	CreateSpaceAdminAction('promote', 'Promotes a user to a space admin.'),
	CreateSpaceAdminAction('demote', 'Demotes a user from a space admin.'),
	{
		key: ['block'],
		usage: '<target>',
		description: 'Blocks a user',
		longDescription: 'Blocks a user from sending you messages. You can unblock them by using the /unblock command.',
		handler: CreateClientCommand()
			.argument('target', ACCOUNT_ID_PARSER)
			.handler(({ directoryConnector }, { target }) => {
				directoryConnector.sendMessage('blockList', {
					id: target,
					action: 'add',
				});
			}),
	},
	{
		key: ['unblock'],
		usage: '<target>',
		description: 'Unblocks a user',
		longDescription: 'Unblocks a user from sending you messages. You can block them by using the /block command.',
		handler: CreateClientCommand()
			.argument('target', ACCOUNT_ID_PARSER)
			.handler(({ directoryConnector }, { target }) => {
				directoryConnector.sendMessage('blockList', {
					id: target,
					action: 'remove',
				});
			}),
	},
	{
		key: ['addcontact'],
		usage: '<target>',
		description: 'Adds a user to your contacts list',
		longDescription: 'Sends the user a request to add the user account to your contacts list.',
		handler: CreateClientCommand()
			.argument('target', ACCOUNT_ID_PARSER)
			.handler(({ directoryConnector }, { target }) => {
				directoryConnector.awaitResponse('friendRequest', {
					id: target,
					action: 'initiate',
				}).catch(() => {
					// TODO add async commands
				});
			}),
	},
	{
		key: ['whisper', 'w'],
		description: 'Sends a private message to a user',
		longDescription: `Sends a message to the selected <target> character which only they will see. (alternative command: '/w')` + LONGDESC_THIRD_PERSON,
		usage: '<target> [message]',
		handler: CreateClientCommand()
			.argument('target', CommandStepOptional(CommandSelectorCharacter({ allowSelf: 'otherCharacter' })))
			.handler({ restArgName: 'message' }, ({ messageSender, inputHandlerContext }, { target }, message) => {
				if (!target) {
					inputHandlerContext.setTarget(null);
					return true;
				}

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
		// const target = undefined; // GetWhisperTarget(args);
		// return target ? { status: 'whisper', target } : { status: 'none' };
		// },
	},
	{
		key: ['dm'],
		description: 'Switches to direct message screen',
		longDescription: 'Switches to direct message screen with the selected <target> character.' + LONGDESC_THIRD_PERSON,
		usage: '<target>',
		handler: CreateClientCommand()
			.argument('target', CommandSelectorCharacter({ allowSelf: 'none' }))
			.handler(({ navigate }, { target }) => {
				navigate(`/contacts/dm/${target.data.accountId}`);
				return true;
			}),
	},
	{
		key: ['inspect'],
		description: 'Inspect an item on a character or in the room inventory',
		longDescription: 'Opens an item dialog for any item worn by a character in the same space or in the room inventory.',
		usage: '<character | room> <item>',
		handler: CreateClientCommand()
			.argument('target', CommandSelectorGameLogicActionTarget())
			.argument('item', CommandSelectorItem('target'))
			.handler((_ctx, { item }) => {
				OpenRoomItemDialog(item.itemId);
				return true;
			}),
	},
	//#region Commands for gambling and playing games
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
		key: ['rockpaperscissors', 'rps'],
		description: 'Play rock paper scissors with people in the same room.',
		longDescription: `Allows each player to secretly choose rock, paper, or scissors.
			If anyone uses 'show', all players with a recent pick will reveal their choice. (alternative command: '/rps')`,
		usage: '<choose | show> \u2026',
		handler: CreateClientCommand()
			.fork('action', (ctx) => ({
				choose: {
					description: 'Choose what you will play in the next round',
					handler: ctx
						.argument('option', CommandSelectorEnum(['rock', 'paper', 'scissors']))
						.handler(({ shardConnector }, { option }) => {
							shardConnector.sendMessage('gamblingAction', {
								type: 'rps',
								choice: option,
							});
							return true;
						}),
				},
				show: {
					description: 'Reveal the choice of all players',
					handler: ctx
						.handler(({ shardConnector }) => {
							shardConnector.sendMessage('gamblingAction', {
								type: 'rps',
								choice: 'show',
							});
							return true;
						}),
				},
			})),
	},
	{
		key: ['dice'],
		description: 'Roll up to 10 100-sided dice.',
		longDescription: `Without any options a single 6-sided die is rolled. The command '/dice 20' rolls a single 20-sided die and '/dice 3d6' rolls 3 6-sided dice. The option '/secret' hides the roll result from others in the room.`,
		usage: `([sides] | <count>d<sides>) [/secret]`,
		handler: CreateClientCommand()
			.argument('options', {
				autocompleteCustomName: '([sides] | <count>d<sides>) [/secret]',
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
						const match = /^(?:(\d+)\s*D)?\s*(\d+)$/i.exec(input);
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
	{
		key: ['deck'],
		description: 'Creates a card deck',
		longDescription: 'Creates an ordinary deck of 52 cards',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ shardConnector }) => {
				shardConnector.sendMessage('gamblingAction', {
					type: 'cards',
					createDeck: true,
				});
				return true;
			}),
	},
	//#endregion
	//#region Commands to change the player's pose
	{
		key: ['turn', 't'],
		description: `Turns yourself around`,
		longDescription: `(alternative command: '/t')`,
		usage: '',
		handler: CreateClientCommand()
			.handler(({ gameState, player }) => {
				const playerState = gameState.globalState.currentState.characters.get(player.id);
				if (!playerState)
					return false;

				gameState.doImmediateAction({
					type: 'pose',
					target: player.data.id,
					view: playerState.requestedPose.view === 'front' ? 'back' : 'front',
				}).catch(() => { /** TODO */ });
				return true;
			}),
	},
	{
		key: ['stand'],
		description: 'Stand up.',
		longDescription: '',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ gameState, player }) => {
				const playerState = gameState.globalState.currentState.characters.get(player.id);
				if (!playerState)
					return false;

				gameState.doImmediateAction({
					type: 'pose',
					target: player.data.id,
					legs: {
						pose: 'standing',
					},
				}).catch(() => { /** TODO */ });
				return true;
			}),
	},
	{
		key: ['kneel'],
		description: 'Kneel down.',
		longDescription: '',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ gameState, player }) => {
				const playerState = gameState.globalState.currentState.characters.get(player.id);
				if (!playerState)
					return false;

				gameState.doImmediateAction({
					type: 'pose',
					target: player.data.id,
					legs: {
						pose: 'kneeling',
					},
				}).catch(() => { /** TODO */ });
				return true;
			}),
	},
	{
		key: ['sit'],
		description: 'Sit down.',
		longDescription: 'May lead to sudden bum / floor impact, if not used carefully',
		usage: '',
		handler: CreateClientCommand()
			.handler(({ gameState, player }) => {
				const playerState = gameState.globalState.currentState.characters.get(player.id);
				if (!playerState)
					return false;

				gameState.doImmediateAction({
					type: 'pose',
					target: player.data.id,
					legs: {
						pose: 'sitting',
					},
				}).catch(() => { /** TODO */ });
				return true;
			}),
	},
	//#endregion
	//#region Commands for expression changes
	{
		key: ['blush'],
		/*
			This manipulates the blushing of a player. The main challenge here was the incredible flexible way,
			pandora handles assets. Currently we only have one blushing variant, but it may be that we will have
			other variants with more or less levels than the current one. So this flexibility had to be dealt with
			when the item was selected. Hopefully the way how 'blush' is extracted from the player can work
			as a blueprint for others.
		*/
		description: 'Increase or decrease your blushing',
		longDescription: '',
		usage: '<+ | - | min | max>',
		handler: CreateClientCommand()
			.argument('options', CommandSelectorEnum(['+', '-', 'min', 'max']))
			.handler(({ gameState, player }, { options }) => {
				// Get the current player so that we can access their worn items
				const playerState = gameState.globalState.currentState.characters.get(player.id);
				if (!playerState)
					return false;

				//Get the actual blush item of the current player to get the current blush level
				const blush = playerState.items.filter(FilterItemType('bodypart')).find((it) => it.asset.definition.bodypart === 'blush');
				if (!blush)
					return false;

				// Get the actual module that we want to manipulate
				const blushModule = blush?.modules.get('blush');

				let newBlush = ''; // The name of the new blush level
				if (blushModule != null && blushModule instanceof ItemModuleTyped) {
					const variants = blushModule.config.variants; //The different options of the chosen blush asset
					const currentBlush = variants.findIndex((v) => v.id === blushModule.activeVariant.id);

					switch (options) {
						case '+':
							newBlush = currentBlush < variants.length - 1 ? variants[currentBlush + 1].id : variants[currentBlush].id;
							break;
						case '-':
							newBlush = currentBlush > 0 ? variants[currentBlush - 1].id : variants[currentBlush].id;
							break;
						case 'min':
							newBlush = variants[0].id;
							break;
						case 'max':
							newBlush = variants[variants.length - 1].id;
							break;
						default: // This shouldn't happen, but hey...
							AssertNever(options);
					} // switch
				} else
					return false;

				gameState.doImmediateAction({
					type: 'moduleAction',
					target: {
						type: 'character',
						characterId: player.data.id,
					},
					item: {
						container: [],
						itemId: blush.id,
					},
					module: 'blush',
					action: {
						moduleType: 'typed',
						setVariant: newBlush,
					},
				}).catch(() => { /** TODO  **/ });
				return true;
			}),
	},
	//#endregion

];
