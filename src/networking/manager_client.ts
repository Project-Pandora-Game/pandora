import { GetLogger, MessageHandler, IClientShardMessageHandler, IClientShardBase, IClientShardUnconfirmedArgument, IsCharacterName, CharacterId, BadMessageError, IClientShardPromiseResult, IsString, IsCharacterIdArray, IsAppearanceAction, DoAppearanceAction } from 'pandora-common';
import { IConnectionClient } from './common';
import { CharacterManager } from '../character/characterManager';
import { assetManager, RawDefinitions as RawAssetsDefinitions } from '../assets/assetManager';
import { ASSETS_SOURCE, SERVER_PUBLIC_ADDRESS } from '../config';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient {
	private readonly _connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientShardMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientShardBase, IConnectionClient>({
			finishCharacterCreation: this.handleFinishCharacterCreation.bind(this),
		}, {
			chatRoomMessage: this.handleChatRoomMessage.bind(this),
			appearanceAction: this.handleAppearanceAction.bind(this),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient): void {
		const [characterId] = (connection.headers.authorization || '').split(' ');
		this._connectedClients.add(connection);
		if (!connection.loadCharacter(characterId as CharacterId) || !connection.character)
			return;
		connection.sendMessage('load', {
			character: connection.character.getData(),
			room: connection.character.room ? connection.character.room.getClientData() : null,
			assetsDefinition: RawAssetsDefinitions,
			assetsDefinitionHash: assetManager.definitionsHash,
			assetsSource: ASSETS_SOURCE || SERVER_PUBLIC_ADDRESS,
		});

		logger.info(`Client ${connection.id} connected to character ${connection.character.id}`);
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: IConnectionClient): void {
		if (!this._connectedClients.has(connection) && !connection.aborted) {
			logger.fatal('Asserting failed: client disconnect while not in connectedClients', connection);
			return;
		}
		this._connectedClients.delete(connection);
	}

	public isAuthorized(id: CharacterId, secret: string): boolean {
		const character = CharacterManager.getCharacter(id);
		return character != null && character.isValid && character.connectSecret === secret;
	}

	private async handleFinishCharacterCreation({ name }: IClientShardUnconfirmedArgument['finishCharacterCreation'], client: IConnectionClient): IClientShardPromiseResult['finishCharacterCreation'] {
		if (!client.character)
			throw new BadMessageError();

		if (!IsCharacterName(name) || !client.character.isInCreation)
			throw new BadMessageError();

		if (!await client.character.finishCreation(name)) {
			return { result: 'failed' };
		}

		return { result: 'ok' };
	}

	private handleChatRoomMessage({ message, targets }: IClientShardUnconfirmedArgument['chatRoomMessage'], client: IConnectionClient): void {
		if (!client.character?.room || !IsString(message) || (targets !== undefined && !IsCharacterIdArray(targets)))
			throw new BadMessageError();

		client.character.room.sendMessage(client.character.id, message, targets);
	}

	private handleAppearanceAction(action: IClientShardUnconfirmedArgument['appearanceAction'], client: IConnectionClient): void {
		if (!client.character || !IsAppearanceAction(action))
			throw new BadMessageError();

		if (!DoAppearanceAction(action, client.character.getAppearanceActionContext(), assetManager)) {
			client.character.sendUpdate();
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
				assetsSource: ASSETS_SOURCE || SERVER_PUBLIC_ADDRESS,
			});
		}
	}
};
