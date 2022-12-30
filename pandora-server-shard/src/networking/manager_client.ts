import { GetLogger, MessageHandler, IClientShard, IClientShardArgument, CharacterId, BadMessageError, IClientShardPromiseResult, IMessageHandler, AssertNever } from 'pandora-common';
import { IConnectionClient } from './common';
import { CharacterManager } from '../character/characterManager';
import { assetManager, RawDefinitions as RawAssetsDefinitions } from '../assets/assetManager';
import { ASSETS_SOURCE, SERVER_PUBLIC_ADDRESS } from '../config';
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
export const ConnectionManagerClient = new class ConnectionManagerClient implements IMessageHandler<IClientShard, IConnectionClient> {
	private readonly _connectedClients: Set<IConnectionClient> = new Set();

	private readonly messageHandler: MessageHandler<IClientShard, IConnectionClient>;

	public async onMessage<K extends keyof IClientShard>(
		messageType: K,
		message: SocketInterfaceRequest<IClientShard>[K],
		context: IConnectionClient,
	): Promise<SocketInterfaceResponse<IClientShard>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
	}

	constructor() {
		this.messageHandler = new MessageHandler<IClientShard, IConnectionClient>({
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
	public onConnect(connection: IConnectionClient): void {
		const [characterId] = (connection.headers.authorization || '').split(' ');
		this._connectedClients.add(connection);
		connectedClientsMetric.set(this._connectedClients.size);
		if (!connection.loadCharacter(characterId as CharacterId) || !connection.character)
			return;
		connection.sendMessage('load', {
			character: connection.character.getData(),
			room: connection.character.room ? connection.character.room.getClientData() : null,
			assetsDefinition: RawAssetsDefinitions,
			assetsDefinitionHash: assetManager.definitionsHash,
			assetsSource: ASSETS_SOURCE || (SERVER_PUBLIC_ADDRESS + '/assets/'),
		});
		connection.character.sendAllPendingMessages();

		logger.debug(`Client ${connection.id} connected to character ${connection.character.id}`);
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: IConnectionClient): void {
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

	private async handleFinishCharacterCreation({ name }: IClientShardArgument['finishCharacterCreation'], client: IConnectionClient): IClientShardPromiseResult['finishCharacterCreation'] {
		if (!client.character)
			throw new BadMessageError();

		if (!client.character.isInCreation)
			throw new BadMessageError();

		if (!await client.character.finishCreation(name)) {
			return { result: 'failed' };
		}

		return { result: 'ok' };
	}

	private handleChatRoomMessage({ messages, id, editId }: IClientShardArgument['chatRoomMessage'], client: IConnectionClient): void {
		if (!client.character?.room)
			throw new BadMessageError();

		if (messages.length === 0 && editId === undefined)
			return;

		const room = client.character.room;
		const character = client.character;

		room.handleMessages(character, messages, id, editId);
	}

	private handleChatRoomMessageAck({ lastTime }: IClientShardArgument['chatRoomMessageAck'], client: IConnectionClient): void {
		if (!client.character?.room)
			throw new BadMessageError();

		client.character.onMessageAck(lastTime);
	}

	private handleChatRoomStatus({ status, target }: IClientShardArgument['chatRoomStatus'], client: IConnectionClient): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const room = client.character.room;
		const character = client.character;

		room.updateStatus(character, status, target);
	}

	private handleChatRoomCharacterMove({ id, position }: IClientShardArgument['chatRoomCharacterMove'], client: IConnectionClient): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const room = client.character.room;
		const character = client.character;

		room.updateCharacterPosition(character, id ?? character.id, position);
	}

	private handleAppearanceAction(action: IClientShardArgument['appearanceAction'], client: IConnectionClient): void {
		if (!client.character)
			throw new BadMessageError();

		if (DoAppearanceAction(action, client.character.getAppearanceActionContext(), assetManager).result !== 'success') {
			client.character.onAppearanceChanged(false);
		}
	}

	private handleUpdateSettings(settings: IClientShardArgument['updateSettings'], client: IConnectionClient): void {
		if (!client.character)
			throw new BadMessageError();

		client.character.setPublicSettings(settings);
	}

	private handleGamblingAction(game: IClientShardArgument['gamblingAction'], client: IConnectionClient): void {
		if (!client.character?.room)
			throw new BadMessageError();

		const room = client.character.room;
		switch (game.type) {
			case 'coinFlip':
				room.handleAppearanceActionMessage({
					id: 'gamblingCoin',
					character: client.character.id,
					dictionary: { 'TOSS_RESULT': Math.random() < 0.5 ? 'heads' : 'tails' },
				});
				break;
			case 'diceRoll': {
				const rolls: number[] = [];
				for (let i = 0; i < game.dice; i++)
					rolls.push(Math.floor(Math.random() * game.sides + 1));
				const result = rolls.length > 1 ? `(${rolls.sort().join(', ')})` : rolls[0].toString();

				if (game.hidden) {
					room.handleAppearanceActionMessage({
						id: 'gamblingDiceHidden',
						character: client.character.id,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
						},
					});
					room.handleAppearanceActionMessage({
						id: 'gamblingDiceHiddenResult',
						character: client.character.id,
						sendTo: [client.character.id],
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
							'DICE_RESULT': result,
						},
					});
				} else {
					room.handleAppearanceActionMessage({
						id: 'gamblingDice',
						character: client.character.id,
						dictionary: {
							'DICE_COUNT': game.dice === 1 ?
								`a ${game.sides}-sided die` :
								`${game.dice} ${game.sides}-sided dice`,
							'DICE_RESULT': `and the result is ${result}.`,
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
			connection.sendMessage('load', {
				character: connection.character.getData(),
				room: connection.character.room ? connection.character.room.getClientData() : null,
				assetsDefinition: RawAssetsDefinitions,
				assetsDefinitionHash: assetManager.definitionsHash,
				assetsSource: ASSETS_SOURCE || (SERVER_PUBLIC_ADDRESS + '/assets/'),
			});
		}
	}
};
