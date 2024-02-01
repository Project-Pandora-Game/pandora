import {
	CharacterId,
	ConnectionBase,
	GetLogger,
	IClientShard,
	IDirectoryCharacterConnectionInfo,
	IShardClientArgument,
	IShardClient,
	MessageHandler,
	ClientShardSchema,
	ShardClientSchema,
	TypedEventEmitter,
	IShardClientChangeEvents,
	Assert,
	CharacterIdSchema,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { connect, Socket } from 'socket.io-client';
import { LoadAssetDefinitions } from '../assets/assetManager';
import { BrowserStorage } from '../browserStorage';
import { GameState } from '../components/gameContext/gameStateContextProvider';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast } from '../persistentToast';
import { ShardConnector, ShardConnectionState } from './shardConnector';
import { ConfigServerIndex } from '../config/searchArgs';

const logger = GetLogger('ShardConn');

export class ShardChangeEventEmitter extends TypedEventEmitter<Record<IShardClientChangeEvents, true>> {
	public onSomethingChanged(changes: IShardClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
}

/** Used for auto-reconnect to character after window refresh */
export const LastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined, CharacterIdSchema.optional());

function CreateConnection({ publicURL, secret, characterId }: IDirectoryCharacterConnectionInfo): Socket {
	// Find which public URL we should actually use
	const publicURLOptions = publicURL.split(';').map((a) => a.trim());
	publicURL = publicURLOptions[ConfigServerIndex % publicURLOptions.length];

	// Create the connection without connecting
	return connect(publicURL, {
		autoConnect: false,
		withCredentials: true,
		extraHeaders: {
			authorization: `${characterId} ${secret}`,
		},
	});
}

const ShardConnectionProgress = new PersistentToast();

/** Class housing connection from Shard to Shard */
export class SocketIOShardConnector extends ConnectionBase<IClientShard, IShardClient, Socket> implements ShardConnector {

	private readonly _state: Observable<ShardConnectionState> = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	private readonly _gameState: Observable<GameState | null>;
	private readonly _connectionInfo: Observable<IDirectoryCharacterConnectionInfo>;
	private readonly _changeEventEmitter = new ShardChangeEventEmitter();
	private readonly _messageHandler: MessageHandler<IShardClient>;

	private loadResolver: ((arg: this) => void) | null = null;

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

	constructor(info: IDirectoryCharacterConnectionInfo) {
		super(CreateConnection(info), [ClientShardSchema, ShardClientSchema], logger);
		this._connectionInfo = new Observable<IDirectoryCharacterConnectionInfo>(info);
		this._gameState = new Observable<GameState | null>(null);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

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
		this.socket.onAny(this.handleMessage.bind(this));
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
	 * @returns Promise of the connection
	 */
	public connect(): Promise<this> {
		if (this._state.value !== ShardConnectionState.NONE) {
			throw new Error('connect can only be called once');
		}
		return new Promise((resolve) => {
			this.setState(ShardConnectionState.INITIAL_CONNECTION_PENDING);
			this.loadResolver = resolve;
			// Attempt to connect
			this.socket.connect();
		});
	}

	/** Disconnect from Shard */
	public disconnect(): void {
		if (this._state.value === ShardConnectionState.NONE) {
			this.setState(ShardConnectionState.DISCONNECTED);
			return;
		}
		if (this._state.value === ShardConnectionState.DISCONNECTED)
			return;
		this.socket.close();
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
			if (this.loadResolver) {
				this.loadResolver(this);
				this.loadResolver = null;
			}
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
