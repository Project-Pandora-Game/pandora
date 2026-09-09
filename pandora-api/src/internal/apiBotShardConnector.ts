import {
	GetLogger,
	HTTP_SOCKET_IO_BOT_PATH,
	IConnectionBase,
	TypedEventEmitter,
	type IMessageHandler,
	type SpaceId,
} from 'pandora-common';
import type { BotId, BotShardConnectionInfo } from 'pandora-common/bots';
import { BotShardSchema, ShardBotSchema, type BotShardSocketAuthMessage, type IBotShard, type IShardBot } from 'pandora-common/networking/api/shard_bot';
import {
	SocketInterfaceRequest,
	SocketInterfaceResponse,
	type SocketInterfaceOneshotMessages,
	type SocketInterfaceRespondedMessages,
} from 'pandora-common/networking/helpers';
import type { Connector, SocketIOConnectorFactory } from './socketio_connector.ts';

/** State of connection to Shard as a Bot */
export enum ApiBotShardConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Shard for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection is waiting for shard to send initial data */
	WAIT_FOR_DATA,
	/** Connection to Shard is currently established */
	CONNECTED,
	/** Connection to Shard lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

/** Class housing connection from Bot API to Shard */
export class ApiBotShardConnector extends TypedEventEmitter<{
	/** Emitted when the connector (re)connects to the server */
	connected: void;
	/** Connection failed */
	connectError: Error;
	/** Connection was lost */
	disconnected: void;
}> implements IConnectionBase<IBotShard> {
	private readonly logger;

	public readonly bot: BotId;
	public readonly space: SpaceId;
	public readonly connectionInfo: BotShardConnectionInfo;

	public readonly messageHandler: IMessageHandler<IShardBot>;

	private _state: ApiBotShardConnectionState = ApiBotShardConnectionState.NONE;
	/** Current state of the connection */
	public get state(): ApiBotShardConnectionState {
		return this._state;
	}

	private _connector: Connector<IBotShard> | null = null;

	constructor(bot: BotId, space: SpaceId, connectionInfo: BotShardConnectionInfo, messageHandler: IMessageHandler<IShardBot>) {
		super();
		this.logger = GetLogger('ApiBotShardConnector', `[ApiBotShardConnector ${bot}|${space}]`);

		this.bot = bot;
		this.space = space;
		this.connectionInfo = connectionInfo;
		this.messageHandler = messageHandler;
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<IBotShard>>(messageType: K, message: SocketInterfaceRequest<IBotShard>[K]): void {
		if (this._connector == null) {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			this.logger.warning(`Dropping outbound message '${messageType}': Not connected`);
			return;
		}
		this._connector.sendMessage(messageType, message);
	}

	public awaitResponse<K extends SocketInterfaceRespondedMessages<IBotShard>>(
		messageType: K,
		message: SocketInterfaceRequest<IBotShard>[K],
		timeout?: number,
	): Promise<SocketInterfaceResponse<IBotShard>[K]> {
		if (this._connector == null) {
			return Promise.reject(new Error('Not connected'));
		}
		return this._connector.awaitResponse(messageType, message, timeout);
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 */
	public connect(serverIndex: number, connectorFactory: SocketIOConnectorFactory<IBotShard, IShardBot, BotShardSocketAuthMessage>): void {
		if (this._state !== ApiBotShardConnectionState.NONE || this._connector != null) {
			throw new Error('connect can only be called once');
		}

		// Find which public URL we should actually use
		const { connectUrl } = this.connectionInfo;
		const publicURLOptions = connectUrl.split(';').map((a) => a.trim());
		let finalUrl = publicURLOptions[serverIndex % publicURLOptions.length];
		if (!finalUrl.endsWith('/')) {
			finalUrl += '/';
		}
		finalUrl += HTTP_SOCKET_IO_BOT_PATH;

		this.setState(ApiBotShardConnectionState.INITIAL_CONNECTION_PENDING);
		this._connector = new connectorFactory({
			uri: finalUrl,
			getAuthData: this.getAuthData.bind(this),
			schema: [BotShardSchema, ShardBotSchema],
			messageHandler: this.messageHandler,
			onConnect: this.onConnect.bind(this),
			onDisconnect: this.onDisconnect.bind(this),
			onConnectError: this.onConnectError.bind(this),
			logger: this.logger,
		});

		this._connector.connect();
	}

	/** Disconnect from Shard */
	public disconnect(): void {
		if (this._state === ApiBotShardConnectionState.NONE) {
			this.setState(ApiBotShardConnectionState.DISCONNECTED);
			return;
		}
		if (this._state === ApiBotShardConnectionState.DISCONNECTED)
			return;
		this.setState(ApiBotShardConnectionState.DISCONNECTED);
		this._connector?.disconnect();
		this.logger.verbose('Disconnected');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ApiBotShardConnectionState): void {
		this._state = newState;
		if (newState === ApiBotShardConnectionState.WAIT_FOR_DATA) {
			this.emit('connected', undefined);
		} else if (newState === ApiBotShardConnectionState.DISCONNECTED) {
			this.emit('disconnected', undefined);
		}
	}

	/** Handle successful connection */
	private onConnect(): void {
		const currentState = this._state;
		if (currentState === ApiBotShardConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ApiBotShardConnectionState.WAIT_FOR_DATA);
			this.logger.verbose('Connected');
		} else if (currentState === ApiBotShardConnectionState.CONNECTION_LOST) {
			this.setState(ApiBotShardConnectionState.WAIT_FOR_DATA);
			this.logger.verbose('Re-Connected');
		} else {
			this.logger.fatal('Assertion failed: received \'connect\' event when in state:', ApiBotShardConnectionState[currentState]);
		}
	}

	/** Handle loss of connection */
	private onDisconnect(reason: string) {
		const currentState = this._state;
		// If the disconnect was requested, just ignore this
		if (currentState === ApiBotShardConnectionState.DISCONNECTED)
			return;
		if (currentState === ApiBotShardConnectionState.CONNECTED || currentState === ApiBotShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ApiBotShardConnectionState.CONNECTION_LOST);
			this.logger.verbose('Lost connection:', reason);
		} else {
			this.logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ApiBotShardConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		this.logger.warning('Connection failed:', err.message);
		this.emit('connectError', err);
	}

	public markInitialDataReceived(): void {
		const currentState = this._state;

		if (currentState === ApiBotShardConnectionState.CONNECTED) {
			// Ignore reloads from shard
		} else if (currentState === ApiBotShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ApiBotShardConnectionState.CONNECTED);
			this.logger.verbose('Received initial space data');
		} else {
			this.logger.fatal('Assertion failed: received \'load\' event when in state:', ApiBotShardConnectionState[currentState]);
		}
	}

	/**
	 * Get data to use to authenticate using socket.io auth mechanism
	 */
	private getAuthData(): BotShardSocketAuthMessage {
		return {
			bot: this.bot,
			space: this.space,
			secret: this.connectionInfo.secret,
			version: 1,
		};
	}
}
