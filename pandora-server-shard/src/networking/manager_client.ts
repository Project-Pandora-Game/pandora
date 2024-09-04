import {
	ActionHandlerMessageTargetCharacter,
	AssertNever,
	BadMessageError,
	CharacterId,
	CloneDeepMutable,
	DoAppearanceAction,
	GameLogicPermissionServer,
	GetLogger,
	IChatMessage,
	IClientShard,
	IClientShardArgument,
	IClientShardNormalResult,
	IClientShardPromiseResult,
	IMessageHandler,
	MessageHandler,
	NaturalListJoin,
	PermissionConfig,
	PermissionSetup,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import promClient from 'prom-client';
import { Character } from '../character/character';
import { CharacterManager } from '../character/characterManager';
import { ClientConnection } from './connection_client';

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
			roomCharacterMove: this.handleRoomCharacterMove.bind(this),
			appearanceAction: this.handleAppearanceAction.bind(this),
			requestPermission: this.handleRequestPermission.bind(this),
			updateSettings: this.handleUpdateSettings.bind(this),
			updateAssetPreferences: this.handleUpdateAssetPreferences.bind(this),
			updateCharacterDescription: this.handleUpdateCharacterDescription.bind(this),
			gamblingAction: this.handleGamblingAction.bind(this),
			permissionCheck: this.handlePermissionCheck.bind(this),
			permissionGet: this.handlePermissionGet.bind(this),
			permissionSet: this.handlePermissionSet.bind(this),
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

	private handleChatMessage({ messages, id, editId }: IClientShardArgument['chatMessage'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		if (messages.length === 0 && editId === undefined)
			return;

		const space = client.character.getOrLoadSpace();
		const character = client.character;

		space.handleMessages(character, messages, id, editId);
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

	private handleRoomCharacterMove({ id, position }: IClientShardArgument['roomCharacterMove'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		const space = client.character.getOrLoadSpace();
		const character = client.character;

		space.updateCharacterPosition(character, id ?? character.id, position);
	}

	private handleAppearanceAction(action: IClientShardArgument['appearanceAction'], client: ClientConnection): IClientShardNormalResult['appearanceAction'] {
		const character = client.character;
		if (!character)
			throw new BadMessageError();

		const globalState = character.getGlobalState();
		const result = DoAppearanceAction(action, character.getAppearanceActionContext(), globalState.currentState);

		// Check if result is valid
		if (!result.valid) {
			const space = character.getOrLoadSpace();
			const target = result.prompt ? space.getCharacterById(result.prompt) : null;
			if (target == null) {
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
			const messages: IChatMessage[] = [];
			for (const message of result.pendingMessages) {
				messages.push(space.mapActionMessageToChatMessage(message));
			}
			target.connection.sendMessage('permissionPrompt', {
				characterId: character.id,
				requiredPermissions,
				messages,
			});
			return { result: 'promptSent' };
		}
		{
			// Apply the action
			globalState.setState(result.resultState);
			const space = character.getOrLoadSpace();

			// Send chat messages as needed
			for (const message of result.pendingMessages) {
				space.handleActionMessage(message);
			}
		}

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
			messages: [],
		});
		return { result: 'promptSent' };
	}

	private handleUpdateSettings(settings: IClientShardArgument['updateSettings'], client: ClientConnection): void {
		if (!client.character)
			throw new BadMessageError();

		client.character.setPublicSettings(settings);
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

		const character: ActionHandlerMessageTargetCharacter = {
			type: 'character',
			id: client.character.id,
		};

		const space = client.character.getOrLoadSpace();
		switch (game.type) {
			case 'coinFlip':
				space.handleActionMessage({
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
					space.handleActionMessage({
						id: 'gamblingDiceHidden',
						character,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
						},
					});
					space.handleActionMessage({
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
					space.handleActionMessage({
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
						character,
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
			targetCharacter = client.character.getOrLoadSpace().getCharacterById(target) ?? null;
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

	public onAssetDefinitionsChanged(): void {
		// Send load event to all currently connected clients, giving them new definitions
		for (const connection of this._connectedClients.values()) {
			if (!connection.character)
				continue;
			connection.sendLoadMessage();
		}
	}
};
