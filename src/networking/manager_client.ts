import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { MessageHandler, IClientShardMessageHandler, IClientShardBase } from 'pandora-common';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export default new class ConnectionManagerClient {
	private connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientShardMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientShardBase, IConnectionClient>({}, {});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient, _auth: unknown): void {
		this.connectedClients.add(connection);
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: IConnectionClient): void {
		if (!this.connectedClients.has(connection)) {
			logger.fatal('Asserting failed: client disconnect while not in connectedClients', connection);
			return;
		}
		this.connectedClients.delete(connection);
	}
};
