import {
	Assert,
	ClientShardSchema,
	GetLogger,
	IClientShard,
	IConnectionBase,
	IDirectoryCharacterConnectionInfo,
	IShardClient,
	IShardClientArgument,
	IShardClientChangeEvents,
	MessageHandler,
	ShardClientSchema,
	TypedEventEmitter,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse, type SocketInterfaceOneshotMessages, type SocketInterfaceRespondedMessages } from 'pandora-common/dist/networking/helpers';
import { Socket } from 'socket.io-client';
import { LoadAssetDefinitions } from '../assets/assetManager';
import { GameState } from '../components/gameContext/gameStateContextProvider';
import { ConfigServerIndex } from '../config/searchArgs';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast } from '../persistentToast';
import type { AccountManager } from '../services/accountLogic/accountManager';
import type { DirectoryConnector } from './directoryConnector';
import { type Connector, type SocketIOConnectorFactory } from './socketio_connector';

/** State of connection to Shard */
export enum ShardConnectionState {
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

const logger = GetLogger('ShardConnector');

export class ShardChangeEventEmitter extends TypedEventEmitter<Record<IShardClientChangeEvents, true>> {
	public onSomethingChanged(changes: IShardClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
}

const ShardConnectionProgress = new PersistentToast();

/** Class housing connection from Shard to Shard */
export class ShardConnector implements IConnectionBase<IClientShard> {

	private readonly _state: Observable<ShardConnectionState> = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	private readonly _gameState: Observable<GameState | null>;
	private readonly _connectionInfo: Observable<IDirectoryCharacterConnectionInfo>;
	private readonly _changeEventEmitter = new ShardChangeEventEmitter();
	private readonly _messageHandler: MessageHandler<IShardClient>;

	public readonly directoryConnector: DirectoryConnector;
	public readonly accountManager: AccountManager;

	/** Current state of the connection */
	public get state(): ReadonlyObservable<ShardConnectionState> {
		return this._state;
	}

	public get gameState(): ReadonlyObservable<GameState | null> {
		return this._gameState;
	}

	public get connectionInfo(): ReadonlyObservable<Readonly<IDirectoryCharacterConnectionInfo>> {
		return this._connectionInfo;
	}

	/** Event emitter for shard change events */
	public get changeEventEmitter(): TypedEventEmitter<Record<IShardClientChangeEvents, true>> {
		return this._changeEventEmitter;
	}

	private _connector: Connector<IClientShard> | null = null;

	constructor(info: IDirectoryCharacterConnectionInfo, directoryConnector: DirectoryConnector, accountManager: AccountManager) {
		this._connectionInfo = new Observable<IDirectoryCharacterConnectionInfo>(info);
		this._gameState = new Observable<GameState | null>(null);
		this.directoryConnector = directoryConnector;
		this.accountManager = accountManager;

		// Setup message handler
		this._messageHandler = new MessageHandler<IShardClient>({
			load: this.onLoad.bind(this),
			updateCharacter: this.onUpdateCharacter.bind(this),
			gameStateLoad: (data: IShardClientArgument['gameStateLoad']) => {
				const gameState = this._gameState.value;
				Assert(gameState != null, 'Received update data without game state');
				gameState.onLoad(data);
			},
			gameStateUpdate: (data: IShardClientArgument['gameStateUpdate']) => {
				const gameState = this._gameState.value;
				Assert(gameState != null, 'Received update data without game state');
				gameState.onUpdate(data);
			},
			chatMessage: (message: IShardClientArgument['chatMessage']) => {
				const gameState = this._gameState.value;
				Assert(gameState != null, 'Received chat message without game state');
				const lastTime = gameState.onMessage(message.messages);
				if (lastTime > 0) {
					this.sendMessage('chatMessageAck', { lastTime });
				}
			},
			chatCharacterStatus: (status: IShardClientArgument['chatCharacterStatus']) => {
				const gameState = this._gameState.value;
				Assert(gameState != null, 'Received chat character status data without game state');
				gameState.onStatus(status);
			},
			somethingChanged: ({ changes }) => this._changeEventEmitter.onSomethingChanged(changes),
			permissionPrompt: (data: IShardClientArgument['permissionPrompt']) => {
				const gameState = this._gameState.value;
				Assert(gameState != null, 'Received permission prompt without game state');
				gameState.onPermissionPrompt(data);
			},
		});
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<IClientShard>>(messageType: K, message: SocketInterfaceRequest<IClientShard>[K]): void {
		if (this._connector == null) {
			logger.warning(`Dropping outbound message '${messageType}': Not connected`);
			return;
		}
		this._connector.sendMessage(messageType, message);
	}

	public awaitResponse<K extends SocketInterfaceRespondedMessages<IClientShard>>(
		messageType: K,
		message: SocketInterfaceRequest<IClientShard>[K],
		timeout?: number,
	): Promise<SocketInterfaceResponse<IClientShard>[K]> {
		if (this._connector == null) {
			return Promise.reject(new Error('Not connected'));
		}
		return this._connector.awaitResponse(messageType, message, timeout);
	}

	protected onMessage<K extends keyof IShardClient>(
		messageType: K,
		message: SocketInterfaceRequest<IShardClient>[K],
	): Promise<SocketInterfaceResponse<IShardClient>[K]> {
		return this._messageHandler.onMessage(messageType, message, undefined);
	}

	public connectionInfoMatches(info: IDirectoryCharacterConnectionInfo): boolean {
		const { id, publicURL, version, characterId, secret } = this._connectionInfo.value;
		return id === info.id &&
			publicURL === info.publicURL &&
			// features === info.features &&
			version === info.version &&
			characterId === info.characterId &&
			secret === info.secret;
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 */
	public connect(connectorFactory: SocketIOConnectorFactory<IClientShard, IShardClient>): void {
		if (this._state.value !== ShardConnectionState.NONE || this._connector != null) {
			throw new Error('connect can only be called once');
		}

		// Find which public URL we should actually use
		const { publicURL, secret, characterId } = this._connectionInfo.value;
		const publicURLOptions = publicURL.split(';').map((a) => a.trim());
		const finalUrl = publicURLOptions[ConfigServerIndex.value % publicURLOptions.length];

		this.setState(ShardConnectionState.INITIAL_CONNECTION_PENDING);
		// Attempt to connect
		this._connector = new connectorFactory({
			uri: finalUrl,
			extraHeaders: {
				authorization: `${characterId} ${secret}`,
			},
			schema: [ClientShardSchema, ShardClientSchema],
			messageHandler: this._messageHandler,
			onConnect: this.onConnect.bind(this),
			onDisconnect: this.onDisconnect.bind(this),
			onConnectError: this.onConnectError.bind(this),
			logger,
		});

		this._connector.connect();
	}

	/** Disconnect from Shard */
	public disconnect(): void {
		if (this._state.value === ShardConnectionState.NONE) {
			this.setState(ShardConnectionState.DISCONNECTED);
			return;
		}
		Assert(this._connector != null);
		if (this._state.value === ShardConnectionState.DISCONNECTED)
			return;
		this._connector.disconnect();
		this.setState(ShardConnectionState.DISCONNECTED);
		logger.info('Disconnected from Shard');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ShardConnectionState): void {
		this._state.value = newState;

		if (newState === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			ShardConnectionProgress.show('progress', 'Connecting to Shard...');
		} else if (newState === ShardConnectionState.WAIT_FOR_DATA) {
			ShardConnectionProgress.show('progress', 'Loading Shard data...');
		} else if (newState === ShardConnectionState.CONNECTED) {
			ShardConnectionProgress.show('success', 'Connected to Shard');
		} else if (newState === ShardConnectionState.CONNECTION_LOST) {
			ShardConnectionProgress.show('progress', 'Shard connection lost\nReconnecting...');
		} else if (newState === ShardConnectionState.DISCONNECTED) {
			ShardConnectionProgress.hide();
		}
	}

	/** Handle successful connection to Shard */
	private onConnect(): void {
		const currentState = this._state.value;
		if (currentState === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			logger.info('Connected to Shard');
		} else if (currentState === ShardConnectionState.CONNECTION_LOST) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			logger.alert('Re-Connected to Shard');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	/** Handle loss of connection to Shard */
	private onDisconnect(reason: Socket.DisconnectReason) {
		const currentState = this._state.value;
		// If the disconnect was requested, just ignore this
		if (currentState === ShardConnectionState.DISCONNECTED)
			return;
		if (currentState === ShardConnectionState.CONNECTED) {
			this.setState(ShardConnectionState.CONNECTION_LOST);
			logger.alert('Lost connection to Shard:', reason);
		} else {
			logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		logger.warning('Connection to Shard failed:', err.message);
	}

	private onLoad({ character, space, globalState, assetsDefinition, assetsDefinitionHash, assetsSource }: IShardClientArgument['load']): void {
		const currentState = this._state.value;

		LoadAssetDefinitions(assetsDefinitionHash, assetsDefinition, assetsSource);
		const currentGameState = this._gameState.value;
		if (currentGameState?.player.data.id === character.id) {
			currentGameState.player.update(character);
			currentGameState.onLoad({ globalState, space });
		} else {
			this._gameState.value = new GameState(this, character, { globalState, space });
		}

		if (currentState === ShardConnectionState.CONNECTED) {
			// Ignore reloads from shard
		} else if (currentState === ShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ShardConnectionState.CONNECTED);
			logger.info('Received initial character data');
		} else {
			logger.fatal('Assertion failed: received \'load\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	private onUpdateCharacter(data: IShardClientArgument['updateCharacter']): void {
		const gameState = this._gameState.value;
		Assert(gameState != null, 'Received update data without game state');
		gameState.player.update(data);
	}
}
