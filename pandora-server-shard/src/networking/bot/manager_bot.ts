import {
	GetLogger,
	IMessageHandler,
	MessageHandler,
} from 'pandora-common';
import type { IBotShard } from 'pandora-common/networking/api/shard_bot';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import promClient from 'prom-client';
import type { BotConnection } from './connection_bot.ts';
import { BotHandlersChat } from './handlers/botChat.ts';

const logger = GetLogger('ConnectionManager-Bot');

const connectedBotsMetric = new promClient.Gauge({
	name: 'pandora_shard_bot_connections',
	help: 'Current count of connections from bots',
	labelNames: ['messageType'],
});

const messagesMetric = new promClient.Counter({
	name: 'pandora_shard_bot_messages',
	help: 'Count of received messages from bots',
	labelNames: ['messageType'],
});

/** Class that stores all currently connected bots */
export const ConnectionManagerBots = new class ConnectionManagerBots implements IMessageHandler<IBotShard, BotConnection> {
	private readonly _connectedBots: Set<BotConnection> = new Set();

	private readonly messageHandler: MessageHandler<IBotShard, BotConnection>;

	public async onMessage<K extends keyof IBotShard>(
		messageType: K,
		message: SocketInterfaceRequest<IBotShard>[K],
		context: BotConnection,
	): Promise<SocketInterfaceResponse<IBotShard>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
	}

	constructor() {
		this.messageHandler = new MessageHandler<IBotShard, BotConnection>({
			...BotHandlersChat,
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: BotConnection): void {
		this._connectedBots.add(connection);
		connectedBotsMetric.set(this._connectedBots.size);
		connection.sendLoadMessage();
	}

	/** Handle disconnecting bot */
	public onDisconnect(connection: BotConnection): void {
		if (!this._connectedBots.has(connection)) {
			logger.warning('Bot disconnect while not in connectedBots', connection);
			return;
		}
		this._connectedBots.delete(connection);
		connectedBotsMetric.set(this._connectedBots.size);
	}

	public onAssetDefinitionsChanged(): void {
		// Send load event to all currently connected bots, giving them new definitions
		for (const connection of this._connectedBots.values()) {
			if (!connection.bot)
				continue;
			connection.sendLoadMessage();
		}
	}
};
