import { Assert, MessageHandler, TypedEventEmitter, type IShardClientChangeEvents, type SpaceId } from 'pandora-common';
import type { BotId, BotShardConnectionInfo } from 'pandora-common/bots';
import type { IShardBot } from 'pandora-common/networking/api/shard_bot';
import { ApiBotShardConnector } from '../../internal/apiBotShardConnector.ts';
import { SocketIOConnector } from '../../internal/socketio_connector.ts';
import type { BotSpaceState } from '../state/botSpaceState.ts';
import { BotSpaceStateImpl } from '../state/botSpaceStateImpl.ts';
import type { SimpleBotOrchestratorBotInstance } from '../utils/simpleBotOrchestrator.ts';

export type BotConnectionEvents = {
	/** Connected (or re-connected) to Shard. Note, that at this point we don't have data yet. */
	connected: void;
	/** Connection failed */
	connectError: Error;
	/** Connection was lost */
	disconnected: void;
	/** Successfully loaded space state. This can happen without disconnect too. Note, that this can change loaded asset manager. */
	loaded: BotSpaceState;

	/** Shard sent `somethingChanged` event. */
	somethingChanged: IShardClientChangeEvents[];
};

export class BotConnection extends TypedEventEmitter<BotConnectionEvents> implements SimpleBotOrchestratorBotInstance {
	public readonly botId: BotId;
	public readonly spaceId: SpaceId;

	private _connection: ApiBotShardConnector | null = null;
	private _connectionCleanup: (() => void)[] = [];
	private _serverIndex: number;

	private _gameState: BotSpaceStateImpl | null = null;
	public get gameState(): BotSpaceState | null {
		return this._gameState;
	}

	constructor(bot: BotId, space: SpaceId, serverIndex: number = 0) {
		super();
		this.botId = bot;
		this.spaceId = space;
		this._serverIndex = serverIndex;
	}

	private _connect(connectionInfo: BotShardConnectionInfo) {
		if (this._connection != null &&
			this._connection.connectionInfo.connectUrl === connectionInfo.connectUrl &&
			this._connection.connectionInfo.secret === connectionInfo.secret
		) {
			// Nothing changed - previous connection is still valid
			return;
		}

		this.disconnect();
		Assert(this._connection == null);

		this._connection = new ApiBotShardConnector(this.botId, this.spaceId, connectionInfo, this._messageHandler);
		// Wire up events
		this._connectionCleanup.push(this._connection.on('connected', (it) => this.emit('connected', it)));
		this._connectionCleanup.push(this._connection.on('connectError', (it) => this.emit('connectError', it)));
		this._connectionCleanup.push(this._connection.on('disconnected', (it) => this.emit('disconnected', it)));

		this._connection.connect(this._serverIndex, SocketIOConnector);
	}

	public updateConnectionInfo(newConnectionInfo: BotShardConnectionInfo): void {
		this._connect(newConnectionInfo);
	}

	public reconnectWithServerIndex(serverIndex: number): void {
		this._serverIndex = serverIndex;

		if (this._connection != null) {
			const connectionInfo = this._connection.connectionInfo;
			this.disconnect();
			this._connect(connectionInfo);
		}
	}

	public disconnect(): void {
		if (this._connection != null) {
			this._connection.disconnect();
			this._connectionCleanup.toReversed().forEach((f) => f());
			this._connectionCleanup = [];
			this._connection = null;
		}
	}

	private _messageHandler: MessageHandler<IShardBot> = new MessageHandler<IShardBot>({
		load: (data) => {
			Assert(this._connection != null);
			this._connection.markInitialDataReceived();

			if (this._gameState != null) {
				this._gameState.handleLoad(data);
			} else {
				this._gameState = new BotSpaceStateImpl(data, this.botId);
			}

			this.emit('loaded', this._gameState);
		},
		updateBotPrivateData: (data) => {
			const gameState = this._gameState;
			Assert(gameState != null, 'Received update data without game state');
			gameState.handleBotPrivateDataUpdate(data);
		},
		gameStateUpdate: (data) => {
			const gameState = this._gameState;
			Assert(gameState != null, 'Received update data without game state');
			gameState.handleUpdate(data);
		},
		somethingChanged: ({ changes }) => this.emit('somethingChanged', changes),
	});
}
