import { freeze, type Immutable } from 'immer';
import {
	Assert,
	CheckPropertiesNotNullable,
	ClientShardSchema,
	GetLogger,
	IClientShard,
	IConnectionBase,
	IDirectoryCharacterConnectionInfo,
	IShardClient,
	IShardClientChangeEvents,
	KnownObject,
	MessageHandler,
	Service,
	ShardClientSchema,
	TypedEventEmitter,
	type CharacterId,
	type MessageHandlers,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import type { SocketInterfaceOneshotMessages, SocketInterfaceRequest, SocketInterfaceRespondedMessages, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import { Socket } from 'socket.io-client';
import { ConfigServerIndex } from '../config/searchArgs.ts';
import { Observable, ReadonlyObservable } from '../observable.ts';
import { PersistentToast } from '../persistentToast.ts';
import type { ClientGameLogicServices, ClientGameLogicServicesConnectionInfo, ClientGameLogicServicesDependencies } from '../services/clientGameLogicServices.ts';
import { type Connector, type SocketIOConnectorFactory } from './socketio_connector.ts';

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

export class ShardChangeEventEmitter extends TypedEventEmitter<Record<IShardClientChangeEvents, true>> {
	public onSomethingChanged(changes: IShardClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
}

const ShardConnectionProgress = new PersistentToast();

type ShardConnectorServiceConfig = Satisfies<{
	dependencies: Pick<ClientGameLogicServices, never> & Pick<ClientGameLogicServicesDependencies, 'connectionInfo'>;
	events: false;
}, ServiceConfigBase>;

/** Class housing connection from Shard to Shard */
export class ShardConnector extends Service<ShardConnectorServiceConfig> implements IConnectionBase<IClientShard> {
	private readonly logger = GetLogger('ShardConnector');

	private readonly _state = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	private readonly _changeEventEmitter = new ShardChangeEventEmitter();

	/** Handlers for server messages. Dependent services are expected to fill those in. */
	public readonly messageHandlers: Partial<MessageHandlers<IShardClient>> = {
		somethingChanged: ({ changes }) => this._changeEventEmitter.onSomethingChanged(changes),
	};

	private _messageHandler: MessageHandler<IShardClient> | null = null;

	/** Current state of the connection */
	public get state(): ReadonlyObservable<ShardConnectionState> {
		return this._state;
	}

	public get connectionInfo(): Immutable<ClientGameLogicServicesConnectionInfo> {
		return this.serviceDeps.connectionInfo;
	}

	/** Event emitter for shard change events */
	public get changeEventEmitter(): TypedEventEmitter<Record<IShardClientChangeEvents, true>> {
		return this._changeEventEmitter;
	}

	private _connector: Connector<IClientShard> | null = null;

	protected override serviceLoad(): void | Promise<void> {
		// Check that all dependent services registered their message handlers during init.
		freeze(this.messageHandlers, false);
		// If you are adding directory->client message you are expected to add an entry here.
		// After doing that you should either:
		// 1) Add the handler above directly to `messageHandlers`
		// 2) Register into `messageHandlers` from `serviceInit` of a service that should be handling this message
		const requiredHandlers: Record<keyof IShardClient, true> = {
			load: true,
			updateCharacter: true,
			gameStateLoad: true,
			gameStateUpdate: true,
			chatMessage: true,
			chatCharacterStatus: true,
			somethingChanged: true,
			permissionPrompt: true,
		};

		if (!CheckPropertiesNotNullable(this.messageHandlers, requiredHandlers)) {
			const missingHandlers = KnownObject.keys(requiredHandlers).filter((h) => this.messageHandlers[h] == null);
			throw new Error(`Not all message handlers were registered during init. Missing handlers: ${missingHandlers.join(', ')}`);
		}

		// Create message handler from these
		this._messageHandler = new MessageHandler<IShardClient>(this.messageHandlers);
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<IClientShard>>(messageType: K, message: SocketInterfaceRequest<IClientShard>[K]): void {
		if (this._connector == null) {
			this.logger.warning(`Dropping outbound message '${messageType}': Not connected`);
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

	public connectionInfoMatches(characterId: CharacterId, connectionInfo: Immutable<IDirectoryCharacterConnectionInfo>): boolean {
		const currentConnectionInfo = this.connectionInfo;
		const { id, secret, publicURL, version } = currentConnectionInfo.shardConnection;

		return currentConnectionInfo.characterId === characterId &&
			id === connectionInfo.id &&
			publicURL === connectionInfo.publicURL &&
			version === connectionInfo.version &&
			secret === connectionInfo.secret;
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

		Assert(this._messageHandler != null); // Should be filled during `load` - way before connect attempt.

		// Find which public URL we should actually use
		const { characterId, shardConnection: { publicURL, secret } } = this.connectionInfo;
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
			logger: this.logger,
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
		this.logger.info('Disconnected from Shard');
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
			this.logger.info('Connected to Shard');
		} else if (currentState === ShardConnectionState.CONNECTION_LOST) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			this.logger.alert('Re-Connected to Shard');
		} else {
			this.logger.fatal('Assertion failed: received \'connect\' event when in state:', ShardConnectionState[currentState]);
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
			this.logger.alert('Lost connection to Shard:', reason);
		} else {
			this.logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ShardConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		this.logger.warning('Connection to Shard failed:', err.message);
	}

	public markInitialDataReceived(): void {
		const currentState = this._state.value;

		if (currentState === ShardConnectionState.CONNECTED) {
			// Ignore reloads from shard
		} else if (currentState === ShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ShardConnectionState.CONNECTED);
			this.logger.info('Received initial character data');
		} else {
			this.logger.fatal('Assertion failed: received \'load\' event when in state:', ShardConnectionState[currentState]);
		}
	}
}

export const ShardConnectorServiceProvider: ServiceProviderDefinition<ClientGameLogicServices, 'shardConnector', ShardConnectorServiceConfig, ClientGameLogicServicesDependencies> = {
	name: 'shardConnector',
	ctor: ShardConnector,
	dependencies: {
		connectionInfo: true,
	},
};
