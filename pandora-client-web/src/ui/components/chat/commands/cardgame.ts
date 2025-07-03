import { CommandSelectorEnum, CommandSelectorNumber } from 'pandora-common';
import { CommandSelectorCharacter, CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

export const COMMAND_CARDGAME: IClientCommand<ICommandExecutionContextClient> = {
	key: ['cards'],
	description: 'Play a game of cards',
	longDescription: `You can 'create' or 'stop' a game of cards, 'join' an existing one, 'deal' cards open or face down to player or the room,
	'check' your hand or 'reveal' the cards that were dealt to all players, ending the game.`,
	usage: 'create [public]| stop | join | dealTable [#cards] | dealOpenly <target> [#cards] | deal <target> [#cards] | check | show | reveal',
	handler: CreateClientCommand()
		.fork('action', (ctx) => ({
			create: {
				description: 'Create a new game with a deck of 52 cards for the current space. Adding "public" after the command shows game messages also to non-participants.',
				handler: ctx
					.argumentOptional('publicGame', CommandSelectorEnum(['public']))
					.handler(({ shardConnector }, { publicGame }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: {
								action: 'create',
								public: publicGame ? true : false,
							},
						});
						return true;
					}),
			},
			stop: {
				description: 'Stop an ongoing game. Only possible for the creator of the game or a space admin.',
				handler: ctx
					.handler(({ shardConnector }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: { action: 'stop' },
						});
						return true;
					}),
			},
			join: {
				description: 'Join an ongoing game.',
				handler: ctx
					.handler(({ shardConnector }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: { action: 'join' },
						});
						return true;
					}),
			},
			dealTable: {
				description: `Deal cards from the space's deck to the space's table. Only possible for the game creator.`,
				handler: ctx
					.argumentOptional('cards', CommandSelectorNumber())
					.handler(({ shardConnector }, { cards }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: {
								action: 'dealTable',
								number: cards ? cards : 1,
							},
						});
						return true;
					}),
			},
			dealOpenly: {
				description: `Deal cards from the space's deck openly to a player. Only possible for the game creator.`,
				handler: ctx
					.argument('target', CommandSelectorCharacter({ allowSelf: 'any' }))
					.argumentOptional('cards', CommandSelectorNumber())
					.handler(({ shardConnector }, { target, cards }) => {
						if (target) {
							shardConnector.sendMessage('gamblingAction', {
								type: 'cards',
								action: {
									action: 'dealOpenly',
									targetId: target.data.id,
									number: cards ? cards : 1,
								},
							});
							return true;
						} else {
							return false;
						}
					}),
			},
			deal: {
				description: `Deal cards from the space's deck hidden to a player. Only possible for the game creator.`,
				handler: ctx
					.argument('target', CommandSelectorCharacter({ allowSelf: 'any' }))
					.argumentOptional('cards', CommandSelectorNumber())
					.handler(({ shardConnector }, { target, cards }) => {
						if (target) {
							shardConnector.sendMessage('gamblingAction', {
								type: 'cards',
								action: {
									action: 'deal',
									targetId: target.data.id,
									number: cards ? cards : 1,
								},
							});
							return true;
						} else {
							return false;
						}
					}),
			},
			reveal: {
				description: `Reveal the cards of all players. Only available for the game's creator.`,
				handler: ctx
					.handler(({ shardConnector }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: { action: 'reveal' },
						});
						return true;
					}),
			},
			check: {
				description: 'Have a look at the cards that were dealt and revealed',
				handler: ctx
					.handler(({ shardConnector }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: { action: 'check' },
						});
						return true;
					}),
			},
			show: {
				description: 'Show your current cards to all players',
				handler: ctx
					.handler(({ shardConnector }) => {
						shardConnector.sendMessage('gamblingAction', {
							type: 'cards',
							action: { action: 'show' },
						});
						return true;
					}),
			},
		})),

};
