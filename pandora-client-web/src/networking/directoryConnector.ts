import { freeze } from 'immer';
import {
	Assert,
	CheckPropertiesNotNullable,
	ClientDirectorySchema,
	CreateDefaultDirectoryStatus,
	DirectoryClientSchema,
	GetLogger,
	HTTP_HEADER_CLIENT_REQUEST_SHARD,
	IClientDirectory,
	IClientDirectoryAuthMessage,
	IConnectionBase,
	IDirectoryCharacterConnectionInfo,
	IDirectoryClient,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	KnownObject,
	MessageHandler,
	Service,
	type MessageHandlers,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse, type SocketInterfaceOneshotMessages, type SocketInterfaceRespondedMessages } from 'pandora-common/dist/networking/helpers.js';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage.ts';
import { AccountContactContext } from '../components/accountContacts/accountContactContext.ts';
import { Observable, ReadonlyObservable } from '../observable.ts';
import { PersistentToast } from '../persistentToast.ts';
import type { ClientServices } from '../services/clientServices.ts';
import type { Connector, SocketIOConnectorFactory } from './socketio_connector.ts';

export type LoginResponse =
	| 'ok'
	| 'verificationRequired'
	| 'invalidToken'
	| 'unknownCredentials'
	| 'invalidSecondFactor'
	| { result: 'accountDisabled'; reason: string; };

/** State of connection to Directory */
export enum DirectoryConnectionState {
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

export interface AuthToken {
	value: string;
	expires: number;
	username: string;
}

const logger = GetLogger('DirectoryConnector');

const AuthTokenSchema = z.object({
	value: z.string(),
	username: z.string(),
	expires: z.number().refine((n) => n > Date.now(), { message: 'Token has expired' }),
}).optional();

type DirectoryConnectorServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: {
		/** Emitted when we receive a `somethingChanged` message from directory. */
		somethingChanged: readonly IDirectoryClientChangeEvents[];
	};
}, ServiceConfigBase>;

/** Class housing connection from Shard to Directory */
export class DirectoryConnector extends Service<DirectoryConnectorServiceConfig> implements IConnectionBase<IClientDirectory> {
	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryConnectionProgress = new PersistentToast();
	private readonly _directoryStatus = new Observable<IDirectoryStatus>(CreateDefaultDirectoryStatus());

	public readonly authToken = BrowserStorage.create<AuthToken | undefined>('authToken', undefined, AuthTokenSchema);
	private _activeCharacterInfo: IDirectoryCharacterConnectionInfo | null = null;

	/** Handlers for server messages. Dependent services are expected to fill those in. */
	public readonly messageHandlers: Partial<MessageHandlers<IDirectoryClient>> = {
		serverStatus: (status) => {
			this._directoryStatus.value = status;
		},
		loginTokenChanged: (data) => {
			Assert(this.authToken.value);
			this.authToken.value = {
				value: data.value,
				expires: data.expires,
				username: this.authToken.value.username,
			};
		},
		somethingChanged: ({ changes }) => {
			this.emit('somethingChanged', changes);
		},
		accountContactInit: (data) => AccountContactContext.handleAccountContactInit(data),
		accountContactUpdate: (data) => AccountContactContext.handleAccountContactUpdate(data),
	};

	private _messageHandler: MessageHandler<IDirectoryClient> | null = null;

	/** Current state of the connection */
	public get state(): ReadonlyObservable<DirectoryConnectionState> {
		return this._state;
	}

	/** Directory status data */
	public get directoryStatus(): ReadonlyObservable<IDirectoryStatus> {
		return this._directoryStatus;
	}

	private _connector: Connector<IClientDirectory> | null = null;

	protected override serviceLoad(): void | Promise<void> {
		// Check that all dependent services registered their message handlers during init.
		freeze(this.messageHandlers, false);
		// If you are adding directory->client message you are expected to add an entry here.
		// After doing that you should either:
		// 1) Add the handler above directly to `messageHandlers`
		// 2) Register into `messageHandlers` from `serviceInit` of a service that should be handling this message
		const requiredHandlers: Record<keyof IDirectoryClient, true> = {
			serverStatus: true,
			connectionState: true,
			loginTokenChanged: true,
			somethingChanged: true,
			directMessageNew: true,
			directMessageAction: true,
			accountContactInit: true,
			accountContactUpdate: true,
		};

		if (!CheckPropertiesNotNullable(this.messageHandlers, requiredHandlers)) {
			const missingHandlers = KnownObject.keys(requiredHandlers).filter((h) => this.messageHandlers[h] == null);
			throw new Error(`Not all message handlers were registered during init. Missing handlers: ${missingHandlers.join(', ')}`);
		}

		// Create message handler from these
		this._messageHandler = new MessageHandler<IDirectoryClient>(this.messageHandlers);
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<IClientDirectory>>(messageType: K, message: SocketInterfaceRequest<IClientDirectory>[K]): void {
		if (this._connector == null) {
			logger.warning(`Dropping outbound message '${messageType}': Not connected`);
			return;
		}
		this._connector.sendMessage(messageType, message);
	}

	public awaitResponse<K extends SocketInterfaceRespondedMessages<IClientDirectory>>(
		messageType: K,
		message: SocketInterfaceRequest<IClientDirectory>[K],
		timeout?: number,
	): Promise<SocketInterfaceResponse<IClientDirectory>[K]> {
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
	public connect(uri: string, connectorFactory: SocketIOConnectorFactory<IClientDirectory, IDirectoryClient, IClientDirectoryAuthMessage | undefined>): void {
		if (this._state.value !== DirectoryConnectionState.NONE || this._connector != null) {
			throw new Error('connect can only be called once');
		}

		Assert(this._messageHandler != null); // Should be filled ruing `load` - way before connect attempt.

		this.setState(DirectoryConnectionState.INITIAL_CONNECTION_PENDING);
		this._connector = new connectorFactory({
			uri,
			getAuthData: this.getAuthData.bind(this),
			schema: [ClientDirectorySchema, DirectoryClientSchema],
			messageHandler: this._messageHandler,
			onConnect: this.onConnect.bind(this),
			onDisconnect: this.onDisconnect.bind(this),
			onConnectError: this.onConnectError.bind(this),
			logger,
		});

		this._connector.connect();
	}

	/** Disconnect from Directory */
	public disconnect(): void {
		if (this._state.value === DirectoryConnectionState.NONE) {
			this.setState(DirectoryConnectionState.DISCONNECTED);
			return;
		}
		Assert(this._connector != null);
		if (this._state.value === DirectoryConnectionState.DISCONNECTED)
			return;
		this._connector.disconnect();
		this.setState(DirectoryConnectionState.DISCONNECTED);
		logger.info('Disconnected from Directory');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: DirectoryConnectionState): void {
		const initial = this._state.value === DirectoryConnectionState.INITIAL_CONNECTION_PENDING;
		this._state.value = newState;

		if (newState === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			this._directoryConnectionProgress.show('progress', 'Connecting to Directory...');
		} else if (newState === DirectoryConnectionState.CONNECTED) {
			this._directoryConnectionProgress.show('success', initial ? 'Connected to Directory' : 'Reconnected to Directory');
		} else if (newState === DirectoryConnectionState.CONNECTION_LOST) {
			this._directoryConnectionProgress.show('progress', 'Directory connection lost\nReconnecting...');
		} else if (newState === DirectoryConnectionState.DISCONNECTED) {
			this._directoryConnectionProgress.hide();
		}
	}

	/** Handle successful connection to Directory */
	private onConnect(): void {
		const currentState = this._state.value;
		if (currentState === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(DirectoryConnectionState.CONNECTED);
			logger.info('Connected to Directory');
		} else if (currentState === DirectoryConnectionState.CONNECTION_LOST) {
			this.setState(DirectoryConnectionState.CONNECTED);
			logger.alert('Re-Connected to Directory');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', DirectoryConnectionState[currentState]);
		}
	}

	/** Handle loss of connection to Directory */
	private onDisconnect(reason: string) {
		const currentState = this._state.value;
		// If the disconnect was requested, just ignore this
		if (currentState === DirectoryConnectionState.DISCONNECTED)
			return;
		if (currentState === DirectoryConnectionState.CONNECTED) {
			this.setState(DirectoryConnectionState.CONNECTION_LOST);
			logger.alert('Lost connection to Directory:', reason);
		} else {
			logger.fatal('Assertion failed: received \'disconnect\' event when in state:', DirectoryConnectionState[currentState]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		logger.warning('Connection to Directory failed:', err.message);
	}

	public setActiveCharacterInfo(character: IDirectoryCharacterConnectionInfo | null): void {
		Assert(this._connector != null);
		this._activeCharacterInfo = character;
		const extraHeaders = {
			[HTTP_HEADER_CLIENT_REQUEST_SHARD]: character?.id || undefined,
		};
		this._connector.setExtraHeaders(extraHeaders);
	}

	/**
	 * Get data to use to authenticate to Directory using socket.io auth mechanism
	 */
	private getAuthData(): IClientDirectoryAuthMessage | undefined {
		const token = this.authToken.value;
		const characterInfo = this._activeCharacterInfo;
		if (token && token.expires > Date.now()) {
			return {
				username: token.username,
				token: token.value,
				character: characterInfo ? {
					id: characterInfo.characterId,
					secret: characterInfo.secret,
				} : null,
			};
		} else {
			return undefined;
		}
	}
}

export const DirectoryConnectorServiceProvider: ServiceProviderDefinition<ClientServices, 'directoryConnector', DirectoryConnectorServiceConfig> = {
	name: 'directoryConnector',
	ctor: DirectoryConnector,
	dependencies: {},
};
