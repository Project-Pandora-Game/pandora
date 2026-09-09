import { Assert, AssertNotNullable, CloneDeepMutable, GetLogger, IncomingConnection, IncomingSocket, IServerSocket, type SpaceId } from 'pandora-common';
import type { BotId } from 'pandora-common/bots';
import { BotShardSchema, ShardBotSchema, type IBotShard, type IShardBot } from 'pandora-common/networking/api/shard_bot';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import { assetManager } from '../../assets/assetManager.ts';
import { ENV } from '../../config.ts';
import type { SpaceBot } from '../../spaces/spaceBot.ts';
import { ConnectionManagerBots } from './manager_bot.ts';
const { ASSETS_SOURCE, SERVER_PUBLIC_ADDRESS } = ENV;

/** Class housing connection from a bot */
export class BotConnection extends IncomingConnection<IShardBot, IBotShard, IncomingSocket> {
	public readonly botId: BotId;
	public readonly spaceId: SpaceId;
	public readonly connectSecret: string;
	public readonly connectionTime: number;

	private _bot: SpaceBot | null = null;
	public get bot(): SpaceBot | null {
		return this._bot;
	}

	constructor(server: IServerSocket<IShardBot>, socket: IncomingSocket, bot: SpaceBot, connectSecret: string) {
		super(server, socket, [ShardBotSchema, BotShardSchema], GetLogger('Connection-Bot', `[Connection-Bot ${socket.id}]`));

		// Link to the bot
		Assert(bot.isValid);
		Assert(bot.state.connectSecret === connectSecret);
		this.botId = bot.id;
		Assert(bot.space.id != null, 'Bot cannot be assigned to a personal space');
		this.spaceId = bot.space.id;
		this.connectSecret = connectSecret;
		bot.setConnection(this);
		this._bot = bot;

		this.connectionTime = Date.now();
		this.logger.verbose(`Connected; Bot: ${this.botId}; Space: ${this.spaceId}`);
		ConnectionManagerBots.onConnect(this);

		if (!this.isConnected()) {
			this.logger.warning('Bot disconnect before onConnect finished');
			queueMicrotask(() => {
				this.onDisconnect('isConnected check failed');
			});
		}
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		this._deAuth('disconnected');
		ConnectionManagerBots.onDisconnect(this);
		super.onDisconnect(reason);
	}

	/**
	 * Handle incoming message from bot
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected onMessage<K extends keyof IBotShard>(
		messageType: K,
		message: SocketInterfaceRequest<IBotShard>[K],
	): Promise<SocketInterfaceResponse<IBotShard>[K]> {
		return ConnectionManagerBots.onMessage(messageType, message, this);
	}

	public override awaitResponse(_messageType: unknown, _message: unknown, _timeout?: unknown): Promise<never> {
		throw new Error('Invalid operation');
	}

	public disconnect(reason: string): void {
		this._deAuth(reason);
		this.socket.disconnect();
	}

	/** Deauthenticate this connection. This does not close the connection - it should be done right before close or in response to it */
	private _deAuth(reason: string): void {
		if (this._bot == null)
			return;

		this.logger.debug(`Deauthenticate (${reason})`);

		Assert(this._bot.connection === this);
		this._bot.setConnection(null);
		this._bot = null;
	}

	public sendLoadMessage(): void {
		AssertNotNullable(this._bot);
		const space = this._bot.space;
		this.sendMessage('load', {
			botPrivate: this._bot.getPrivateData(),
			globalState: space.currentState.exportToClientBundle(),
			space: space.getLoadData('bot'),
			assetsDefinition: CloneDeepMutable(assetManager.rawData),
			assetsDefinitionHash: assetManager.definitionsHash,
			assetsSource: ASSETS_SOURCE || (SERVER_PUBLIC_ADDRESS.split(';').map((addr) => addr.trim() + '/assets/').join(';')),
		});
	}
}
