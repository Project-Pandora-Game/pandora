import {
	Assert,
	CheckPropertiesNotNullable,
	GetLogger,
	IConnectionBase,
	KnownObject,
	MessageHandler,
	Service,
	type MessageHandlers,
	type PandoraAccessToken,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import {
	ApiDirectorySchema,
	DirectoryApiSchema,
	type ApiDirectorySocketAuthMessage,
	type IApiDirectory,
	type IDirectoryApi,
} from 'pandora-common/networking/api/directory_api';
import {
	SocketInterfaceRequest,
	SocketInterfaceResponse,
	type SocketInterfaceOneshotMessages,
	type SocketInterfaceRespondedMessages,
} from 'pandora-common/networking/helpers';
import type { ApiDirectoryServices } from './apiDirectoryServices.ts';
import type { Connector, SocketIOConnectorFactory } from './socketio_connector.ts';

/** State of connection to Directory */
export enum ApiDirectoryConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Directory for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection to Directory is currently established */
	CONNECTED,
	/** Connection to Directory lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

type ApiDirectoryConnectorServiceConfig = Satisfies<{
	dependencies: Pick<ApiDirectoryServices, never>;
	events: {
		/** Emitted when the connector (re)connects to the server */
		connected: void;
		/** Connection failed */
		connectError: Error;
	};
}, ServiceConfigBase>;

/** Class housing connection from Shard to Directory */
export class ApiDirectoryConnector extends Service<ApiDirectoryConnectorServiceConfig> implements IConnectionBase<IApiDirectory> {
	private readonly logger = GetLogger('ApiDirectoryConnector');

	private _state: ApiDirectoryConnectionState = ApiDirectoryConnectionState.NONE;

	/** Handlers for server messages. Dependent services are expected to fill those in. */
	public readonly messageHandlers: Partial<MessageHandlers<IDirectoryApi>> = {};

	private _messageHandler: MessageHandler<IDirectoryApi> | null = null;

	/** Current state of the connection */
	public get state(): ApiDirectoryConnectionState {
		return this._state;
	}

	private _connector: Connector<IApiDirectory> | null = null;
	private _token: PandoraAccessToken | null = null;

	protected override serviceLoad(): void | Promise<void> {
		// Check that all dependent services registered their message handlers during init.
		// If you are adding directory->client message you are expected to add an entry here.
		// After doing that you should either:
		// 1) Add the handler above directly to `messageHandlers`
		// 2) Register into `messageHandlers` from `serviceInit` of a service that should be handling this message
		const requiredHandlers: Record<keyof IDirectoryApi, true> = {
		};

		if (!CheckPropertiesNotNullable(this.messageHandlers, requiredHandlers)) {
			const missingHandlers = KnownObject.keys(requiredHandlers).filter((h) => this.messageHandlers[h] == null);
			throw new Error(`Not all message handlers were registered during init. Missing handlers: ${missingHandlers.join(', ')}`);
		}

		// Create message handler from these
		this._messageHandler = new MessageHandler<IDirectoryApi>(this.messageHandlers);
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<IApiDirectory>>(messageType: K, message: SocketInterfaceRequest<IApiDirectory>[K]): void {
		if (this._connector == null) {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			this.logger.warning(`Dropping outbound message '${messageType}': Not connected`);
			return;
		}
		this._connector.sendMessage(messageType, message);
	}

	public awaitResponse<K extends SocketInterfaceRespondedMessages<IApiDirectory>>(
		messageType: K,
		message: SocketInterfaceRequest<IApiDirectory>[K],
		timeout?: number,
	): Promise<SocketInterfaceResponse<IApiDirectory>[K]> {
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
	public connect(uri: string, token: PandoraAccessToken, connectorFactory: SocketIOConnectorFactory<IApiDirectory, IDirectoryApi, ApiDirectorySocketAuthMessage | undefined>): void {
		if (this._state !== ApiDirectoryConnectionState.NONE || this._connector != null) {
			throw new Error('connect can only be called once');
		}

		Assert(this._messageHandler != null); // Should be filled during `load` - way before connect attempt.
		this._token = token;

		this.setState(ApiDirectoryConnectionState.INITIAL_CONNECTION_PENDING);
		this._connector = new connectorFactory({
			uri,
			getAuthData: this.getAuthData.bind(this),
			schema: [ApiDirectorySchema, DirectoryApiSchema],
			messageHandler: this._messageHandler,
			onConnect: this.onConnect.bind(this),
			onDisconnect: this.onDisconnect.bind(this),
			onConnectError: this.onConnectError.bind(this),
			logger: this.logger,
		});

		this._connector.connect();
	}

	/** Disconnect from Directory */
	public disconnect(): void {
		if (this._state === ApiDirectoryConnectionState.NONE) {
			this.setState(ApiDirectoryConnectionState.DISCONNECTED);
			return;
		}
		Assert(this._connector != null);
		if (this._state === ApiDirectoryConnectionState.DISCONNECTED)
			return;
		this._connector.disconnect();
		this.setState(ApiDirectoryConnectionState.DISCONNECTED);
		this.logger.verbose('Disconnected from Directory');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ApiDirectoryConnectionState): void {
		this._state = newState;
		if (newState === ApiDirectoryConnectionState.CONNECTED) {
			this.emit('connected', undefined);
		}
	}

	/** Handle successful connection to Directory */
	private onConnect(): void {
		const currentState = this._state;
		if (currentState === ApiDirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ApiDirectoryConnectionState.CONNECTED);
			this.logger.verbose('Connected to Directory');
		} else if (currentState === ApiDirectoryConnectionState.CONNECTION_LOST) {
			this.setState(ApiDirectoryConnectionState.CONNECTED);
			this.logger.info('Re-Connected to Directory');
		} else {
			this.logger.fatal('Assertion failed: received \'connect\' event when in state:', ApiDirectoryConnectionState[currentState]);
		}
	}

	/** Handle loss of connection to Directory */
	private onDisconnect(reason: string) {
		const currentState = this._state;
		// If the disconnect was requested, just ignore this
		if (currentState === ApiDirectoryConnectionState.DISCONNECTED)
			return;
		if (currentState === ApiDirectoryConnectionState.CONNECTED) {
			this.setState(ApiDirectoryConnectionState.CONNECTION_LOST);
			this.logger.info('Lost connection to Directory:', reason);
		} else {
			this.logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ApiDirectoryConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		this.logger.warning('Connection to Directory failed:', err.message);
		this.emit('connectError', err);
	}

	/**
	 * Get data to use to authenticate to Directory using socket.io auth mechanism
	 */
	private getAuthData(): ApiDirectorySocketAuthMessage | undefined {
		if (this._token == null)
			return undefined;

		return {
			token: this._token,
			version: 1,
		};
	}
}

export const ApiDirectoryConnectorServiceProvider: ServiceProviderDefinition<ApiDirectoryServices, 'directoryConnector', ApiDirectoryConnectorServiceConfig> = {
	name: 'directoryConnector',
	ctor: ApiDirectoryConnector,
	dependencies: {},
};
