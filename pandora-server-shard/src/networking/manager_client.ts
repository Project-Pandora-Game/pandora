import { GetLogger, MessageHandler, IClientShard, IClientShardArgument, CharacterId, BadMessageError, IClientShardPromiseResult } from 'pandora-common';
import { IConnectionClient } from './common';
import { CharacterManager } from '../character/characterManager';
import { assetManager, RawDefinitions as RawAssetsDefinitions } from '../assets/assetManager';
import { ASSETS_SOURCE, SERVER_PUBLIC_ADDRESS } from '../config';
import promClient from 'prom-client';
import { DoAppearanceAction } from 'pandora-common';

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
export const ConnectionManagerClient = new class ConnectionManagerClient {
	private readonly _connectedClients: Set<IConnectionClient> = new Set();

	private readonly messageHandler: MessageHandler<IClientShard, IConnectionClient>;

	public onMessage(messageType: string, message: Record<string, unknown>, callback: ((arg: Record<string, unknown>) => void) | undefined, connection: IConnectionClient): Promise<boolean> {
		return this.messageHandler.onMessage(messageType, message, callback, connection).then((result) => {
			// Only count valid messages
			if (result) {
				messagesMetric.inc({ messageType });
			}
			return result;
		});
	}

	constructor() {
		this.messageHandler = new MessageHandler<IClientShard, IConnectionClient>({
			finishCharacterCreation: this.handleFinishCharacterCreation.bind(this),
		}, {
			chatRoomMessage: this.handleChatRoomMessage.bind(this),
			appearanceAction: this.handleAppearanceAction.bind(this),
			chatRoomMessageAck: this.handleChatRoomMessageAck.bind(this),
			chatRoomStatus: this.handleChatRoomStatus.bind(this),
			chatRoomCharacterMove: this.handleChatRoomCharacterMove.bind(this),
			updateSettings: this.handleUpdateSettings.bind(this),
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

		if (!DoAppearanceAction(action, client.character.getAppearanceActionContext(), assetManager)) {
			client.character.onAppearanceChanged(false);
		}
	}

	private handleUpdateSettings(settings: IClientShardArgument['updateSettings'], client: IConnectionClient): void {
		if (!client.character)
			throw new BadMessageError();

		client.character.setPublicSettings(settings);
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
