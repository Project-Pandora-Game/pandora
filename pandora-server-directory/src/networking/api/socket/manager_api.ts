import { GetLogger, IMessageHandler, MessageHandler, ServerService } from 'pandora-common';
import type { IApiDirectory } from 'pandora-common/networking/api/directory_api';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import promClient from 'prom-client';
import type { ApiConnection } from './connection_api.ts';
import { ApiHandlersToken } from './handlers/token.ts';

const logger = GetLogger('ConnectionManager-Api');

const connectedClientsMetric = new promClient.Gauge({
	name: 'pandora_directory_api_socket_connections',
	help: 'Current count of connections from API',
	labelNames: [],
});

const messagesMetric = new promClient.Counter({
	name: 'pandora_directory_api_socket_messages',
	help: 'Count of received messages from API',
	labelNames: ['messageType'],
});

/** Class that stores all currently connected clients */
export const ConnectionManagerApi = new class ConnectionManagerApi implements IMessageHandler<IApiDirectory, ApiConnection>, ServerService {
	private readonly connectedClients: Set<ApiConnection> = new Set();
	private readonly messageHandler: MessageHandler<IApiDirectory, ApiConnection>;

	public async onMessage<K extends keyof IApiDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IApiDirectory>[K],
		context: ApiConnection,
	): Promise<SocketInterfaceResponse<IApiDirectory>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
	}

	/** Init the manager */
	public init(): void {
		// Nothing to do here
	}

	public onDestroy(): void {
		// Nothing to do here
	}

	constructor() {
		this.messageHandler = new MessageHandler<IApiDirectory, ApiConnection>({
			...ApiHandlersToken,
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: ApiConnection): void {
		this.connectedClients.add(connection);
		connectedClientsMetric.set(this.connectedClients.size);
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: ApiConnection): void {
		if (!this.connectedClients.has(connection)) {
			logger.warning('Client disconnect while not in connectedClients', connection);
			return;
		}
		this.connectedClients.delete(connection);
		connectedClientsMetric.set(this.connectedClients.size);
	}
};
