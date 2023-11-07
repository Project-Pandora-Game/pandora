import { GetLogger, MessageHandler, IClientShard, IClientShardArgument, CharacterId, BadMessageError, IClientShardPromiseResult, IMessageHandler, AssertNever, ActionHandlerMessageTargetCharacter, IClientShardNormalResult } from 'pandora-common';
import { ClientConnection } from './connection_client';
import { CharacterManager } from '../character/characterManager';
import { assetManager } from '../assets/assetManager';
import promClient from 'prom-client';
import { DoAppearanceAction } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { Character } from '../character/character';

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

	private readonly rockPaperScissorsStatus: WeakMap<Character, { time: number; choice: string; }>;

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
			chatRoomMessage: this.handleChatRoomMessage.bind(this),
			chatRoomStatus: this.handleChatRoomStatus.bind(this),
			chatRoomMessageAck: this.handleChatRoomMessageAck.bind(this),
			chatRoomCharacterMove: this.handleChatRoomCharacterMove.bind(this),
			appearanceAction: this.handleAppearanceAction.bind(this),
			updateSettings: this.handleUpdateSettings.bind(this),
			gamblingAction: this.handleGamblingAction.bind(this),
			permissionCheck: this.handlePermissionCheck.bind(this),
			permissionGet: this.handlePermissionGet.bind(this),
			permissionSet: this.handlePermissionSet.bind(this),
		});
		this.rockPaperScissorsStatus = new WeakMap();
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
			logger.fatal('Asserting failed: client disconnect while not in connectedClients', connection);
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

	private handleChatRoomMessage({ messages, id, editId }: IClientShardArgument['chatRoomMessage'], client: ClientConnection): void {
		if (!client.character?.room)
			throw new BadMessageError();

		if (messages.length === 0 && editId === undefined)
			return;

		const room = client.character.room;
		const character = client.character;

		room.handleMessages(character, messages, id, editId);
	}

	private handleChatRoomMessageAck({ lastTime }: IClientShardArgument['chatRoomMessageAck'], client: ClientConnection): void {
		if (!client.character?.room)
			throw new BadMessageError();

		client.character.onMessageAck(lastTime);
	}

	private handleChatRoomStatus({ status, target }: IClientShardArgument['chatRoomStatus'], client: ClientConnection): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const room = client.character.room;
		const character = client.character;

		room.updateStatus(character, status, target);
	}

	private handleChatRoomCharacterMove({ id, position }: IClientShardArgument['chatRoomCharacterMove'], client: ClientConnection): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const room = client.character.room;
		const character = client.character;

		room.updateCharacterPosition(character, id ?? character.id, position);
	}

	private handleAppearanceAction(action: IClientShardArgument['appearanceAction'], client: ClientConnection): IClientShardNormalResult['appearanceAction'] {
		const character = client.character;
		if (!character)
			throw new BadMessageError();

		const result = DoAppearanceAction(action, character.getAppearanceActionContext(), assetManager);

		// Check if result is valid
		if (!result.valid || result.problems.length > 0) {
			// If the action failed, client might be out of sync, force-send full reload
			client.sendLoadMessage();
			return {
				result: 'failure',
				problems: result.problems.slice(),
			};
		}

		// Apply the action
		character.getGlobalState().setState(result.resultState);

		// Send chat messages as needed
		for (const message of result.pendingMessages) {
			character.room?.handleActionMessage(message);
		}

		return {
			result: 'success',
		};
	}

	private handleUpdateSettings(settings: IClientShardArgument['updateSettings'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		client.character.setPublicSettings(settings);
	}

	private handleGamblingAction(game: IClientShardArgument['gamblingAction'], client: ClientConnection): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const character: ActionHandlerMessageTargetCharacter = {
			type: 'character',
			id: client.character.id,
		};

		const room = client.character.room;
		switch (game.type) {
			case 'coinFlip':
				room.handleActionMessage({
					id: 'gamblingCoin',
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
					room.handleActionMessage({
						id: 'gamblingDiceHidden',
						character,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
						},
					});
					room.handleActionMessage({
						id: 'gamblingDiceHiddenResult',
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
					room.handleActionMessage({
						id: 'gamblingDice',
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

					for (const c of client.character.room.getAllCharacters()) {
						if (this.rockPaperScissorsStatus.has(c)) {
							const status = this.rockPaperScissorsStatus.get(c);

							if (status && Date.now() < status?.time + 10 * 60 * 1000) {
								if (status.choice === 'rock') {
									rock.push(c.name + ` (${ c.id })`);
								} else if (status.choice === 'paper') {
									paper.push(c.name + ` (${ c.id })`);
								} else if (status.choice === 'scissors') {
									scissors.push(c.name + ` (${ c.id })`);
								} else {
									throw new BadMessageError();
								}
								this.rockPaperScissorsStatus.delete(c);
							} else {
								this.rockPaperScissorsStatus.delete(c);
							}
						}
					}
					room.handleActionMessage({
						id: 'gamblingRockPaperScissorsResult',
						character,
						dictionary: {
							'ROCK_CHARACTERS': rock.length > 0 ? rock.join(', ') : 'No one',
							'PAPER_CHARACTERS': paper.length > 0 ? paper.join(', ') : 'No one',
							'SCISSORS_CHARACTERS': scissors.length > 0 ? scissors.join(', ') : 'No one',
						},
					});
				} else if (['rock', 'paper', 'scissors'].includes(game.choice)) {
					this.rockPaperScissorsStatus.set(client.character, { time: Date.now(), choice: game.choice });
					room.handleActionMessage({
						id: 'gamblingRockPaperScissorsSet',
						character,
						dictionary: {},
					});
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
			targetCharacter = client.character.room?.getCharacterById(target) ?? null;
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
			result: checkResult ? 'ok' : 'noAccess',
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
			permissionSetup: permission.setup,
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

		permission.setConfig(config);
		return {
			result: 'ok',
		};
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
