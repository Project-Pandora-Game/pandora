import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { MessageHandler, IClientShardMessageHandler, IClientShardBase, IClientShardUnconfirmedArgument, IsCharacterName, CharacterId, BadMessageError, IClientShardPromiseResult } from 'pandora-common';
import { DirectoryConnector } from './socketio_directory_connector';
import { CharacterManager } from '../character/characterManager';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient {
	private readonly _connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientShardMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientShardBase, IConnectionClient>({
			finishCharacterCreation: this.handleFinishCharacterCreation.bind(this),
		}, {
			disconnectCharacter: this.handleDisconnectCharacter.bind(this),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient): void {
		const [characterId] = (connection.headers.authorization || '').split(' ');
		connection.loadCharacter(characterId as CharacterId);
		this._connectedClients.add(connection);
		connection.sendMessage('loadCharacter', connection.character.data);

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
		return character != null && character.connectSecret === secret;
	}

	private handleDisconnectCharacter(_: IClientShardUnconfirmedArgument['disconnectCharacter'], client: IConnectionClient): void {
		CharacterManager.invalidateCharacter(client.character.id);

		DirectoryConnector.sendMessage('characterDisconnected', { id: client.character.id });

		client.abortConnection();
	}

	private async handleFinishCharacterCreation({ name }: IClientShardUnconfirmedArgument['finishCharacterCreation'], client: IConnectionClient): IClientShardPromiseResult['finishCharacterCreation'] {
		if (!IsCharacterName(name) || !client.character.data.inCreation)
			throw new BadMessageError();

		if (!await client.character.finishCreation(name)) {
			return { result: 'failed' };
		}

		return { result: 'ok' };
	}
};
