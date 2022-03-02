import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { MessageHandler, IClientShardMessageHandler, IClientShardBase, IClientShardUnconfirmedArgument, IsCharacterName, CharacterId, BadMessageError } from 'pandora-common';
import { DirectoryConnector } from './socketio_directory_connector';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export default new class ConnectionManagerClient {
	private readonly _connectedClients: Set<IConnectionClient> = new Set();
	private readonly _connectionSecrets: Map<CharacterId, { secret: string; }> = new Map();

	readonly messageHandler: IClientShardMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientShardBase, IConnectionClient>({}, {
			disconnectCharacter: this.handleDisconnectCharacter.bind(this),
			finishCharacterCreation: this.handleFinishCharacterCreation.bind(this),
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

	public addSecret(id: CharacterId, secret: string): void {
		this._connectionSecrets.set(id, { secret });
	}

	public isAuthorized(id: CharacterId, secret: string): boolean {
		const { secret: storedSecret } = this._connectionSecrets.get(id) || {};
		return storedSecret === secret;
	}

	private handleDisconnectCharacter(_: IClientShardUnconfirmedArgument['disconnectCharacter'], client: IConnectionClient): void {
		if (!this._connectionSecrets.delete(client.character.id))
			throw new BadMessageError();

		DirectoryConnector.sendMessage('characterDisconnected', { id: client.character.id });

		client.abortConnection();
	}

	private async handleFinishCharacterCreation({ name }: IClientShardUnconfirmedArgument['finishCharacterCreation'], client: IConnectionClient): Promise<void> {
		if (!IsCharacterName(name) || !client.character.data.inCreation)
			throw new BadMessageError();

		await client.character.finishCreation(name);
	}
};
