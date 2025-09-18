import { freeze } from 'immer';
import {
	AbortActionAttempt,
	ActionHandlerMessageTargetCharacter,
	Assert,
	AssertNever,
	BadMessageError,
	CardGameGame,
	CardArraysToString,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterId,
	CharacterModifierActionCheckAdd,
	CharacterModifierActionCheckLockModify,
	CharacterModifierActionCheckModify,
	CharacterModifierActionCheckRead,
	CharacterModifierActionCheckReorder,
	CloneDeepMutable,
	DoImmediateAction,
	FinishActionAttempt,
	GameLogicPermissionServer,
	GetLogger,
	IClientShard,
	IClientShardArgument,
	IClientShardNormalResult,
	IClientShardPromiseResult,
	IMessageHandler,
	MessageHandler,
	NaturalListJoin,
	PermissionConfig,
	PermissionSetup,
	RedactSensitiveActionData,
	StartActionAttempt,
	type AppearanceAction,
	type AppearanceActionProcessingResult,
	type CharacterRestrictionsManager,
	type GameLogicModifierInstanceServer,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers.js';
import promClient from 'prom-client';
import { Character } from '../character/character.ts';
import { CharacterManager } from '../character/characterManager.ts';
import { ClientConnection } from './connection_client.ts';

const logger = GetLogger('ConnectionManager-Client');

const connectedClientsMetric = new promClient.Gauge({
	name: 'pandora_shard_client_connections',
	help: 'Current count of connections from clients',
	labelNames: ['messageType'],
});

const messagesMetric = new promClient.Counter({
	name: 'pandora_shard_client_messages',
	help: 'Count of received messages from clients',
	labelNames: ['messageType'],
});

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient implements IMessageHandler<IClientShard, ClientConnection> {
	private readonly _connectedClients: Set<ClientConnection> = new Set();

	private readonly messageHandler: MessageHandler<IClientShard, ClientConnection>;

	private readonly rockPaperScissorsStatus = new WeakMap<Character, { time: number; choice: 'rock' | 'paper' | 'scissors'; }>();

	public async onMessage<K extends keyof IClientShard>(
		messageType: K,
		message: SocketInterfaceRequest<IClientShard>[K],
		context: ClientConnection,
	): Promise<SocketInterfaceResponse<IClientShard>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
	}

	constructor() {
		this.messageHandler = new MessageHandler<IClientShard, ClientConnection>({
			finishCharacterCreation: this.handleFinishCharacterCreation.bind(this),
			chatMessage: this.handleChatMessage.bind(this),
			chatStatus: this.handleChatStatus.bind(this),
			chatMessageAck: this.handleChatMessageAck.bind(this),
			gameLogicAction: this.handleGameLogicAction.bind(this),
			requestPermission: this.handleRequestPermission.bind(this),
			changeSettings: this.handleChangeSettings.bind(this),
			updateAssetPreferences: this.handleUpdateAssetPreferences.bind(this),
			updateCharacterDescription: this.handleUpdateCharacterDescription.bind(this),
			gamblingAction: this.handleGamblingAction.bind(this),
			permissionCheck: this.handlePermissionCheck.bind(this),
			permissionGet: this.handlePermissionGet.bind(this),
			permissionSet: this.handlePermissionSet.bind(this),
			characterModifiersGet: this.handleCharacterModifiersGet.bind(this),
			characterModifierAdd: this.handleCharacterModifierAdd.bind(this),
			characterModifierReorder: this.handleCharacterModifierReorder.bind(this),
			characterModifierDelete: this.handleCharacterModifierDelete.bind(this),
			characterModifierConfigure: this.handleCharacterModifierConfigure.bind(this),
			characterModifierLock: this.handleCharacterModifierLock.bind(this),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: ClientConnection): void {
		const [characterId] = (connection.headers.authorization || '').split(' ');
		this._connectedClients.add(connection);
		connectedClientsMetric.set(this._connectedClients.size);
		if (!connection.loadCharacter(characterId as CharacterId) || !connection.character)
			return;
		connection.sendLoadMessage();
		connection.character.sendAllPendingMessages();
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: ClientConnection): void {
		if (!this._connectedClients.has(connection) && !connection.aborted) {
			logger.warning('Client disconnect while not in connectedClients', connection);
			return;
		}
		this._connectedClients.delete(connection);
		connectedClientsMetric.set(this._connectedClients.size);
	}

	public isAuthorized(id: CharacterId, secret: string): boolean {
		const character = CharacterManager.getCharacter(id);
		return character != null && character.isValid && character.connectSecret === secret;
	}

	private async handleFinishCharacterCreation({ name }: IClientShardArgument['finishCharacterCreation'], client: ClientConnection): IClientShardPromiseResult['finishCharacterCreation'] {
		if (!client.character)
			throw new BadMessageError();

		if (!client.character.isInCreation)
			throw new BadMessageError();

		if (!await client.character.finishCreation(name)) {
			return { result: 'failed' };
		}

		return { result: 'ok' };
	}

	private handleChatMessage({ messages, id, editId }: IClientShardArgument['chatMessage'], client: ClientConnection): IClientShardNormalResult['chatMessage'] {
		if (!client.character)
			throw new BadMessageError();

		// Ignore empty messages
		if (messages.length === 0 && editId === undefined)
			return { result: 'ok' };

		const space = client.character.getOrLoadSpace();
		const character = client.character;

		return space.handleMessages(character, messages, id, editId);
	}

	private handleChatMessageAck({ lastTime }: IClientShardArgument['chatMessageAck'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		client.character.onMessageAck(lastTime);
	}

	private handleChatStatus({ status, target }: IClientShardArgument['chatStatus'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		const space = client.character.getOrLoadSpace();
		const character = client.character;

		space.updateStatus(character, status, target);
	}

	private handleGameLogicAction(request: IClientShardArgument['gameLogicAction'], client: ClientConnection): IClientShardNormalResult['gameLogicAction'] {
		const character = client.character;
		if (!character)
			throw new BadMessageError();

		const space = character.getOrLoadSpace();
		const originalState = space.currentState;
		const now = Date.now();
		let result: AppearanceActionProcessingResult;

		if (request.operation === 'doImmediately') {
			freeze(request.action, true);
			result = DoImmediateAction(request.action, character.getAppearanceActionContext(), originalState);
		} else if (request.operation === 'start') {
			freeze(request.action, true);
			result = StartActionAttempt(request.action, character.getAppearanceActionContext(), originalState, now);
		} else if (request.operation === 'complete') {
			result = FinishActionAttempt(character.getAppearanceActionContext(), originalState, now);
		} else if (request.operation === 'abortCurrentAction') {
			result = AbortActionAttempt(character.getAppearanceActionContext(), originalState);
		} else {
			AssertNever(request.operation);
		}

		// Check if result is valid
		if (!result.valid) {
			const target = result.prompt ? space.getCharacterById(result.prompt) : null;
			// The action failed and not because of promptable permission
			if (target == null) {
				// If finishing an action attempt was what failed for any other reason than "tooSoon", then cancel it
				if (request.operation === 'complete' && result.problems.some((p) => p.result !== 'tooSoon')) {
					const cancelResult = AbortActionAttempt(character.getAppearanceActionContext(), originalState);
					if (cancelResult.valid) {
						space.applyAction(cancelResult);
					} else {
						logger.error(`Failed to abort action attempt by ${character.id} for failed action completion:\n`, cancelResult.problems);
					}
				}
				// If the action failed, client might be out of sync, force-send full reload
				client.sendLoadMessage();
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}
			if (target.connection == null) {
				return { result: 'promptFailedCharacterOffline' };
			}
			const requiredPermissions: [PermissionSetup, PermissionConfig | null][] = [];
			for (const permission of result.requiredPermissions) {
				if (permission instanceof GameLogicPermissionServer) {
					requiredPermissions.push([CloneDeepMutable(permission.setup), permission.getConfig()]);
				}
			}
			const actions: AppearanceAction[] = result.performedActions
				.map((a) => RedactSensitiveActionData(a));

			target.connection.sendMessage('permissionPrompt', {
				characterId: character.id,
				requiredPermissions,
				actions,
			});
			return { result: 'promptSent' };
		}
		// Apply the action
		space.applyAction(result);

		return {
			result: 'success',
			data: result.actionData,
		};
	}

	private handleRequestPermission({ target, permissions }: IClientShardArgument['requestPermission'], client: ClientConnection): IClientShardNormalResult['requestPermission'] {
		const character = client.character;
		if (!character)
			throw new BadMessageError();

		const space = character.getOrLoadSpace();
		const player = character.gameLogicCharacter;
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			// If the target isn't found, fail
			return {
				result: 'failure',
			};
		}
		if (targetCharacter.connection == null) {
			return { result: 'promptFailedCharacterOffline' };
		}
		const requiredPermissions: [PermissionSetup, PermissionConfig | null][] = [];
		for (const [permissionGroup, permissionId] of permissions) {
			const permission = targetCharacter.gameLogicCharacter.getPermission(permissionGroup, permissionId);
			if (permission == null) {
				return {
					result: 'failure',
				};
			}

			// Deny request immediately if some permission is denied
			const checkResult = permission.checkPermission(player);
			if (checkResult === 'no') {
				return {
					result: 'failure',
				};
			}

			requiredPermissions.push([CloneDeepMutable(permission.setup), permission.getConfig()]);
		}
		targetCharacter.connection.sendMessage('permissionPrompt', {
			characterId: character.id,
			requiredPermissions,
			actions: [],
		});
		return { result: 'promptSent' };
	}

	private handleChangeSettings(request: IClientShardArgument['changeSettings'], client: ClientConnection): IClientShardNormalResult['changeSettings'] {
		if (!client.character)
			throw new BadMessageError();

		if (request.type === 'set') {
			client.character.changeSettings(request.settings);
		} else if (request.type === 'reset') {
			client.character.resetSettings(request.settings);
		} else {
			AssertNever(request);
		}

		return { result: 'ok' };
	}

	private handleUpdateAssetPreferences(preferences: IClientShardArgument['updateAssetPreferences'], client: ClientConnection): IClientShardNormalResult['updateAssetPreferences'] {
		if (!client.character)
			throw new BadMessageError();

		const result = client.character.setAssetPreferences(preferences);

		return { result };
	}

	private handleUpdateCharacterDescription({ profileDescription }: IClientShardArgument['updateCharacterDescription'], client: ClientConnection): IClientShardNormalResult['updateCharacterDescription'] {
		if (!client.character)
			throw new BadMessageError();

		client.character.updateCharacterDescription(profileDescription);

		return { result: 'ok' };
	}

	private handleGamblingAction(game: IClientShardArgument['gamblingAction'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		const space = client.character.getOrLoadSpace();

		const character: ActionHandlerMessageTargetCharacter = {
			type: 'character',
			id: client.character.id,
		};
		const characterRoom = client.character.getRestrictionManager().appearance.characterState.currentRoom;

		switch (game.type) {
			case 'coinFlip':
				space.handleActionMessage({
					id: 'gamblingCoin',
					rooms: [characterRoom],
					character,
					dictionary: { 'TOSS_RESULT': Math.random() < 0.5 ? 'heads' : 'tails' },
				});
				break;
			case 'diceRoll': {
				const rolls: number[] = [];
				for (let i = 0; i < game.dice; i++)
					rolls.push(Math.floor(Math.random() * game.sides + 1));
				const result = rolls.length > 1 ? `(${rolls.sort().join(', ')})` : rolls[0].toString();

				if (game.hidden) {
					space.handleActionMessage({
						id: 'gamblingDiceHidden',
						rooms: [characterRoom],
						character,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
						},
					});
					space.handleActionMessage({
						id: 'gamblingDiceHiddenResult',
						rooms: [characterRoom],
						character,
						sendTo: [client.character.id],
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
							'DICE_RESULT': result,
						},
					});
				} else {
					space.handleActionMessage({
						id: 'gamblingDice',
						rooms: [characterRoom],
						character,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
							'DICE_RESULT': result,
						},
					});
				}
				break;
			}
			case 'rps': {
				if (game.choice === 'show') {
					const rock: string[] = [];
					const paper: string[] = [];
					const scissors: string[] = [];

					for (const c of space.getAllCharacters()) {
						const status = this.rockPaperScissorsStatus.get(c);
						this.rockPaperScissorsStatus.delete(c);

						if (status != null && Date.now() < status.time + 10 * 60 * 1000) {
							if (status.choice === 'rock') {
								rock.push(c.name + ` (${c.id})`);
							} else if (status.choice === 'paper') {
								paper.push(c.name + ` (${c.id})`);
							} else if (status.choice === 'scissors') {
								scissors.push(c.name + ` (${c.id})`);
							} else {
								AssertNever(status.choice);
							}
						}
					}
					space.handleActionMessage({
						id: 'gamblingRockPaperScissorsResult',
						rooms: null,
						character,
						dictionary: {
							'ROCK_CHARACTERS': rock.length > 0 ? NaturalListJoin(rock) : 'no one',
							'PAPER_CHARACTERS': paper.length > 0 ? NaturalListJoin(paper) : 'no one',
							'SCISSORS_CHARACTERS': scissors.length > 0 ? NaturalListJoin(scissors) : 'no one',
						},
					});
				} else {
					this.rockPaperScissorsStatus.set(client.character, { time: Date.now(), choice: game.choice });
					space.handleActionMessage({
						id: 'gamblingRockPaperScissorsSet',
						rooms: null,
						character,
					});
				}
				break;
			}
			case 'cards': {
				const player = space.getCharacterById(character.id);
				if (player) {
					if (space.cardGame) {
						const receivers = space.cardGame.isPublic() ? undefined : space.cardGame.getPlayerIds();
						switch (game.action.action) {
							case 'create':
								// only one game can be there at a time
								space.handleActionMessage({
									id: 'gamblingCardGameAlreadyCreated',
									rooms: null,
									character,
									sendTo: [client.character.id],
									dictionary: {
										'DEALER': `${space.getCharacterById(space.cardGame.getDealerId())?.name}`,
									},
								});
								break;
							case 'stop': {
								// stops the current game, allowed for dealers and room admins
								if (space.cardGame.isDealer(client.character.id) || space.isAdmin(client.character)) {
									space.handleActionMessage({
										id: 'gamblingCardGameStopped',
										rooms: null,
										character,
										sendTo: receivers,
									});
									space.cardGame = null;
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameNotAllowed',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'join': {
								if (space.cardGame.joinGame(character.id)) {
									const players = space.cardGame.getPlayerIds().filter((p) =>
										p !== space.cardGame?.getDealerId() && p !== character.id)
										.map((p) => space.getCharacterById(p)?.name)
										.filter((name): name is string => !! name);
									space.handleActionMessage({
										id: 'gamblingCardGameJoined',
										rooms: null,
										character,
										sendTo: receivers,
										dictionary: {
											'DEALER': `${space.getCharacterById(space.cardGame.getDealerId())?.name}`,
										},
									});
									space.handleActionMessage({
										id: 'gamblingCardGameYouJoined',
										rooms: null,
										character,
										sendTo: [client.character.id],
										dictionary: {
											'DEALER': `${space.getCharacterById(space.cardGame.getDealerId())?.name}`,
											'PLAYERS': players.length > 0 ? players.join(', ') : 'None',
										},
									});
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameJoinedAlready',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'dealTable': {
								if (space.cardGame.isDealer(client.character.id)) {
									// Deals a card to the whole room
									const cards = space.cardGame.dealTo(game.action.number ?? 1);
									if (!cards) {
										space.handleActionMessage({
											id: 'gamblingCardGameEmpty',
											rooms: null,
											sendTo: [client.character.id],
										});
									} else {
										//Dealt to the room openly
										space.handleActionMessage({
											id: 'gamblingCardGameDealOpen',
											rooms: null,
											character,
											sendTo: receivers,
											dictionary: {
												'CARD': CardArraysToString(cards),
											},
										});
									}
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameNotAllowed',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'dealOpenly': {
								if (space.cardGame.isDealer(client.character.id)) {
									// Deals a card openly to a player
									if (!space.cardGame.isPlayer(game.action.targetId)) {
										space.handleActionMessage({
											id: 'gamblingCardNotAPlayer',
											rooms: null,
											sendTo: [client.character.id],
										});
										break; //Done on purpose
									}
									const card = space.cardGame.dealTo(game.action.number ?? 1, game.action.targetId, true);
									if (!card) {
										space.handleActionMessage({
											id: 'gamblingCardGameEmpty',
											rooms: null,
											sendTo: [client.character.id],
										});
									} else {
										//Deal to the player openly
										space.handleActionMessage({
											id: 'gamblingCardGameDealPlayerOpen',
											rooms: null,
											character,
											sendTo: receivers,
											target: { type: 'character', id: game.action.targetId },
											dictionary: {
												'CARD': CardArraysToString(card),
											},
										});
									}
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameNotAllowed',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'deal': {
								if (space.cardGame.isDealer(client.character.id)) {
									// Deals a hidden card to a character
									if (!space.cardGame.isPlayer(game.action.targetId)) {
										space.handleActionMessage({
											id: 'gamblingCardNotAPlayer',
											rooms: null,
											sendTo: [client.character.id],
										});
										break; //Done on purpose
									}
									const cards = space.cardGame.dealTo(game.action.number ?? 1, game.action.targetId, false);
									if (!cards) {
										space.handleActionMessage({
											id: 'gamblingCardGameEmpty',
											rooms: null,
											sendTo: [client.character.id],
										});
									} else {
										space.handleActionMessage({
											id: 'gamblingCardGameDealPlayerSecret',
											rooms: null,
											character,
											target: { type: 'character', id: game.action.targetId },
											sendTo: receivers,
											dictionary: {
												'COUNT': `${cards.length} card${cards.length > 1 ? 's' : ''}`,
											},
										});
										space.handleActionMessage({
											id: 'gamblingCardGameDealToYou',
											rooms: null,
											character,
											sendTo: [game.action.targetId],
											dictionary: {
												'CARD': CardArraysToString(cards),
											},
										});
									}
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameNotAllowed',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'check': {
								// Show the player's hand and all already revealed cards
								const spaceHand = space.cardGame.getSpaceHand();
								space.handleActionMessage({
									id: 'gamblingCardGameHandCheck',
									rooms: null,
									character,
									sendTo: [client.character.id],
									dictionary: {
										'HAND': space.cardGame.getPlayerHand(client.character.id, false),
										'ISARE': (spaceHand === 'nothing' || spaceHand.length < 2) ? 'is' : 'are',
										'TABLE': spaceHand,
									},
								});
								//Show the revealed cards of all players
								space.cardGame.getPlayerIds().filter((p) => p !== character.id).
									forEach((id) => space.handleActionMessage({
										id: 'gamblingCardGamePlayerCheck',
										rooms: null,
										character,
										sendTo: [character.id],
										dictionary: {
											'PLAYER': `${space.getCharacterById(id)?.name}`,
											'HAND': `${space.cardGame?.getPlayerHand(id, true)}`,
										},
									}));
								break;
							}
							case 'reveal': {
								if (space.cardGame.isDealer(client.character.id)) {
									// Send the cards of all players to the players and end the game
									const spaceHand = space.cardGame.getSpaceHand();
									// Remind players of the cards on the table
									space.handleActionMessage({
										id: 'gamblingCardGameRoomCards',
										rooms: null,
										character,
										sendTo: receivers,
										dictionary: {
											'HAND': spaceHand,
											'ISARE': (spaceHand === 'nothing' || spaceHand.length < 2) ? 'is' : 'are',
										},
									});
									//Show the cards of all players
									space.cardGame.getPlayerIds().forEach((id) => space.handleActionMessage({
										id: 'gamblingCardGameHandShow',
										rooms: null,
										character,
										sendTo: receivers,
										dictionary: {
											'PLAYER': `${space.getCharacterById(id)?.name}`,
											'HAND': `${space.cardGame?.getPlayerHand(id, false)}`,
										},
									}));
									space.cardGame = null;
								} else {
									space.handleActionMessage({
										id: 'gamblingCardGameNotAllowed',
										rooms: null,
										sendTo: [client.character.id],
										character,
									});
								}
								break;
							}
							case 'show': {
								space.cardGame.revealHand(client.character.id);
								space.handleActionMessage({
									id: 'gamblingCardGameHandShow',
									rooms: null,
									character,
									sendTo: receivers,
									dictionary: {
										'PLAYER': `${space.getCharacterById(client.character.id)?.name}`,
										'HAND': `${space.cardGame?.getPlayerHand(client.character.id, true)}`,
									},
								});
								break;
							}
							default:
								AssertNever(game.action);
						}
					} else {
						if (game.action.action === 'create') {
							space.cardGame = new CardGameGame(character.id, game.action.public);
							space.handleActionMessage({
								id: 'gamblingCardGameCreation',
								rooms: null,
								character,
							});
						} else {
							space.handleActionMessage({
								id: 'gamblingCardGameNoGame',
								rooms: null,
								sendTo: [client.character.id],
								character,
							});
						}
					}
				}
				break;
			}
			default:
				AssertNever(game);
		}
	}

	private handlePermissionCheck({ target, permissionGroup, permissionId }: IClientShardArgument['permissionCheck'], client: ClientConnection): IClientShardNormalResult['permissionCheck'] {
		if (!client.character)
			throw new BadMessageError();

		let targetCharacter: Character | null;

		if (client.character.id === target) {
			targetCharacter = client.character;
		} else {
			targetCharacter = client.character.getOrLoadSpace().getCharacterById(target);
		}

		if (targetCharacter == null) {
			return {
				result: 'notFound',
			};
		}

		const permission = targetCharacter.gameLogicCharacter.getPermission(permissionGroup, permissionId);
		if (permission == null) {
			return {
				result: 'notFound',
			};
		}

		const checkResult = permission.checkPermission(client.character.gameLogicCharacter);

		return {
			result: 'ok',
			permission: checkResult,
		};
	}

	private handlePermissionGet({ permissionGroup, permissionId }: IClientShardArgument['permissionGet'], client: ClientConnection): IClientShardNormalResult['permissionGet'] {
		if (!client.character)
			throw new BadMessageError();

		const permission = client.character.gameLogicCharacter.getPermission(permissionGroup, permissionId);
		if (permission == null) {
			return {
				result: 'notFound',
			};
		}

		return {
			result: 'ok',
			permissionSetup: CloneDeepMutable(permission.setup),
			permissionConfig: permission.getConfig(),
		};
	}

	private handlePermissionSet({ permissionGroup, permissionId, config }: IClientShardArgument['permissionSet'], client: ClientConnection): IClientShardNormalResult['permissionSet'] {
		if (!client.character)
			throw new BadMessageError();

		const permission = client.character.gameLogicCharacter.getPermission(permissionGroup, permissionId);
		if (permission == null) {
			return {
				result: 'notFound',
			};
		}

		const result = permission.setConfig(config);
		return {
			result,
		};
	}

	private handleCharacterModifiersGet({ target }: IClientShardArgument['characterModifiersGet'], client: ClientConnection): IClientShardNormalResult['characterModifiersGet'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'notFound',
			};
		}

		// Check that the source character is allowed to get this data
		const checkResult = client.character.checkAction((ctx) => CharacterModifierActionCheckRead(ctx, target));

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		return {
			result: 'ok',
			modifiers: targetCharacter.gameLogicCharacter.characterModifiers.getClientData(),
		};
	}

	private handleCharacterModifierAdd({ target, modifier, enabled }: IClientShardArgument['characterModifierAdd'], client: ClientConnection): IClientShardNormalResult['characterModifierAdd'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'characterNotFound',
			};
		}

		// Check that the source character is allowed to get this data
		const checkResult = client.character.checkAction((ctx) => CharacterModifierActionCheckAdd(ctx, target, modifier.type));

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		const result = targetCharacter.gameLogicCharacter.characterModifiers.addModifier(modifier, enabled, client.character.gameLogicCharacter);

		if (result === 'invalidConfiguration' || result === 'tooManyModifiers') {
			return {
				result,
			};
		}

		// Send a chat notification if editing modifiers on someone else
		if (client.character.id !== target) {
			space.handleActionMessage({
				id: 'characterModifierAdd',
				rooms: null,
				character: {
					type: 'character',
					id: client.character.id,
				},
				sendTo: [target],
				dictionary: {
					'MODIFIER_NAME': modifier.name || CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type].visibleName,
				},
			});
		}

		return {
			result: 'ok',
			instanceId: result.id,
		};
	}
	private handleCharacterModifierReorder({ target, modifier, shift }: IClientShardArgument['characterModifierReorder'], client: ClientConnection): IClientShardNormalResult['characterModifierReorder'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'characterNotFound',
			};
		}

		// Check that the source character is allowed to get this data
		const checkResult = client.character.checkAction((ctx) => CharacterModifierActionCheckReorder(
			ctx,
			target,
			targetCharacter.gameLogicCharacter.characterModifiers.modifierInstances,
			modifier,
			shift,
		));

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		const result = targetCharacter.gameLogicCharacter.characterModifiers.reorderModifier(modifier, shift);

		if (!result) {
			return {
				result: 'failure',
				problems: [
					{ result: 'invalidAction' },
				],
				canPrompt: false,
			};
		}

		// Send a chat notification if editing modifiers on someone else
		if (client.character.id !== target) {
			space.handleActionMessage({
				id: 'characterModifierReorder',
				rooms: null,
				character: {
					type: 'character',
					id: client.character.id,
				},
				sendTo: [target],
			});
		}

		return {
			result: 'ok',
		};
	}
	private handleCharacterModifierDelete({ target, modifier }: IClientShardArgument['characterModifierDelete'], client: ClientConnection): IClientShardNormalResult['characterModifierDelete'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'characterNotFound',
			};
		}

		// Check that the source character is allowed to get this data
		let modifierInstance: GameLogicModifierInstanceServer | null | undefined;
		const checkResult = client.character.checkAction((ctx) => {
			modifierInstance = targetCharacter.gameLogicCharacter.characterModifiers.getModifier(modifier);
			if (modifierInstance == null)
				return ctx.invalid();

			return CharacterModifierActionCheckModify(ctx, target, modifierInstance);
		});

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		Assert(modifierInstance != null);
		targetCharacter.gameLogicCharacter.characterModifiers.deleteModifier(modifier);

		// Send a chat notification if editing modifiers on someone else
		if (client.character.id !== target) {
			space.handleActionMessage({
				id: 'characterModifierRemove',
				rooms: null,
				character: {
					type: 'character',
					id: client.character.id,
				},
				sendTo: [target],
				dictionary: {
					'MODIFIER_NAME': modifierInstance.name || CHARACTER_MODIFIER_TYPE_DEFINITION[modifierInstance.type].visibleName,
				},
			});
		}

		return {
			result: 'ok',
		};
	}

	private handleCharacterModifierConfigure({ target, modifier, config }: IClientShardArgument['characterModifierConfigure'], client: ClientConnection): IClientShardNormalResult['characterModifierConfigure'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'characterNotFound',
			};
		}

		// Check that the source character is allowed to get this data
		let modifierInstance: GameLogicModifierInstanceServer | null | undefined;
		const checkResult = client.character.checkAction((ctx) => {
			modifierInstance = targetCharacter.gameLogicCharacter.characterModifiers.getModifier(modifier);
			if (modifierInstance == null)
				return ctx.invalid();

			return CharacterModifierActionCheckModify(ctx, target, modifierInstance);
		});

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		Assert(modifierInstance != null);
		const result = targetCharacter.gameLogicCharacter.characterModifiers.configureModifier(modifier, config);

		if (result === true) {
			// Send a chat notification if editing modifiers on someone else
			if (client.character.id !== target) {
				const character: ActionHandlerMessageTargetCharacter = {
					type: 'character',
					id: client.character.id,
				};
				const originalName = modifierInstance.name || CHARACTER_MODIFIER_TYPE_DEFINITION[modifierInstance.type].visibleName;
				const newName = config.name != null ? (config.name || CHARACTER_MODIFIER_TYPE_DEFINITION[modifierInstance.type].visibleName) : originalName;

				if (config.conditions != null || config.config != null) {
					space.handleActionMessage({
						id: 'characterModifierChange',
						rooms: null,
						character,
						sendTo: [target],
						dictionary: {
							'MODIFIER_NAME': originalName,
						},
					});
				}
				if (config.lockExceptions != null) {
					space.handleActionMessage({
						id: 'characterModifierLockExceptionsChange',
						rooms: null,
						character,
						sendTo: [target],
						dictionary: {
							'MODIFIER_NAME': originalName,
						},
					});
				}
				if (config.name != null && config.name !== modifierInstance.name) {
					space.handleActionMessage({
						id: 'characterModifierRename',
						rooms: null,
						character,
						sendTo: [target],
						dictionary: {
							'MODIFIER_NAME_OLD': originalName,
							'MODIFIER_NAME': newName,
						},
					});
				}
				if (config.enabled != null && config.enabled !== modifierInstance.enabled) {
					space.handleActionMessage({
						id: config.enabled ? 'characterModifierEnable' : 'characterModifierDisable',
						rooms: null,
						character,
						sendTo: [target],
						dictionary: {
							'MODIFIER_NAME': newName,
						},
					});
				}
			}

			return {
				result: 'ok',
			};
		}

		switch (result) {
			case 'invalidConfiguration':
				return {
					result: 'invalidConfiguration',
				};
			case 'failure':
				return {
					result: 'failure',
					problems: [
						{ result: 'invalidAction' },
					],
					canPrompt: false,
				};
		}
		AssertNever(result);
	}

	private handleCharacterModifierLock({ target, modifier, action }: IClientShardArgument['characterModifierLock'], client: ClientConnection): IClientShardNormalResult['characterModifierLock'] {
		if (!client.character)
			throw new BadMessageError();

		// Find the target
		const space = client.character.getOrLoadSpace();
		const targetCharacter = space.getCharacterById(target);
		if (targetCharacter == null) {
			return {
				result: 'characterNotFound',
			};
		}

		// Check that the source character is allowed to do this action
		let modifierInstance: GameLogicModifierInstanceServer | null | undefined;
		let player: CharacterRestrictionsManager | undefined;
		const checkResult = client.character.checkAction((ctx) => {
			player = ctx.getPlayerRestrictionManager();
			modifierInstance = targetCharacter.gameLogicCharacter.characterModifiers.getModifier(modifier);
			if (modifierInstance == null)
				return ctx.invalid();

			return CharacterModifierActionCheckLockModify(ctx, target, modifierInstance, action);
		});

		if (!checkResult.valid) {
			return {
				result: 'failure',
				problems: checkResult.problems.slice(),
				canPrompt: checkResult.prompt === target,
			};
		}

		Assert(modifierInstance != null);
		Assert(player != null);
		const result = targetCharacter.gameLogicCharacter.characterModifiers.doLockAction(
			modifier,
			{
				player,
				isSelfAction: target === player.appearance.id,
				executionContext: 'act',
			},
			action,
		);

		if (result.result === 'ok') {
			// Send a chat notification if editing modifiers on someone else
			if (client.character.id !== target) {
				const character: ActionHandlerMessageTargetCharacter = {
					type: 'character',
					id: client.character.id,
				};
				const name = modifierInstance.name || CHARACTER_MODIFIER_TYPE_DEFINITION[modifierInstance.type].visibleName;

				switch (action.action) {
					case 'addLock': {
						const lockAsset = player.appearance.getAssetManager().getAssetById(action.lockAsset);
						space.handleActionMessage({
							id: 'characterModifierLockAdd',
							rooms: null,
							character,
							sendTo: [target],
							dictionary: {
								'MODIFIER_NAME': name,
								'LOCK_TYPE': (
									lockAsset?.definition.chat?.chatDescriptor ||
									lockAsset?.definition.name
								) ?? `[UNKNOWN ASSET '${action.lockAsset}']`,
							},
						});
					}
						break;
					case 'removeLock':
						space.handleActionMessage({
							id: 'characterModifierLockRemove',
							rooms: null,
							character,
							sendTo: [target],
							dictionary: {
								'MODIFIER_NAME': name,
							},
						});
						break;
					case 'lockAction':
						switch (action.lockAction.action) {
							case 'lock':
								space.handleActionMessage({
									id: 'characterModifierLockLock',
									rooms: null,
									character,
									sendTo: [target],
									dictionary: {
										'MODIFIER_NAME': name,
									},
								});
								break;
							case 'unlock':
								space.handleActionMessage({
									id: 'characterModifierLockUnlock',
									rooms: null,
									character,
									sendTo: [target],
									dictionary: {
										'MODIFIER_NAME': name,
									},
								});
								break;
							case 'showPassword':
								// No message for show password
								break;
							case 'updateFingerprint':
								space.handleActionMessage({
									id: 'characterModifierLockUpdateFingerprint',
									rooms: null,
									character,
									sendTo: [target],
									dictionary: {
										'MODIFIER_NAME': name,
									},
								});
								break;
							default:
								AssertNever(action.lockAction);
						}
						break;
					default:
						AssertNever(action);
				}
			}

			return result;
		}

		switch (result.result) {
			case 'failure':
				return {
					result: 'failure',
					problems: result.problems,
					canPrompt: false,
				};
		}
		AssertNever(result);
	}

	public onAssetDefinitionsChanged(): void {
		// Send load event to all currently connected clients, giving them new definitions
		for (const connection of this._connectedClients.values()) {
			if (!connection.character)
				continue;
			connection.sendLoadMessage();
		}
	}
};
