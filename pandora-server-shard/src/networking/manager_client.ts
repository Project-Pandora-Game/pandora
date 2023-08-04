import { GetLogger, MessageHandler, IClientShard, IClientShardArgument, CharacterId, BadMessageError, IClientShardPromiseResult, IMessageHandler, AssertNever, ActionHandlerMessageTargetCharacter, IClientShardNormalResult } from 'pandora-common';
import { ClientConnection } from './connection_client';
import { CharacterManager } from '../character/characterManager';
import { assetManager } from '../assets/assetManager';
import promClient from 'prom-client';
import { DoAppearanceAction } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';

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
		if (!client.character)
			throw new BadMessageError();

		const result = DoAppearanceAction(action, client.character.getAppearanceActionContext(), assetManager);
		switch (result.result) {
			case 'success':
				return { result: 'success' };
			case 'failure':
				return {
					result: 'failure',
					failure: result.failure,
				};
			default:
				// If the action failed, client might be out of sync, force-send full reload
				client.sendLoadMessage();
				return { result: 'invalid' };
		}
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
			default:
				AssertNever(game);
		}
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
