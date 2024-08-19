import { freeze } from 'immer';
import {
	Assert,
	AsyncSynchronized,
	CharacterId,
	CharacterIdSchema,
	CheckPropertiesNotNullable,
	ClientDirectorySchema,
	CreateDefaultDirectoryStatus,
	DirectoryClientSchema,
	EMPTY,
	GetLogger,
	HTTP_HEADER_CLIENT_REQUEST_SHARD,
	IClientDirectory,
	IClientDirectoryArgument,
	IClientDirectoryAuthMessage,
	IConnectionBase,
	IDirectoryAccountInfo,
	IDirectoryCharacterConnectionInfo,
	IDirectoryClient,
	IDirectoryClientArgument,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	KnownObject,
	MessageHandler,
	SecondFactorData,
	SecondFactorResponse,
	Service,
	type MessageHandlers,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse, type SocketInterfaceOneshotMessages, type SocketInterfaceRespondedMessages } from 'pandora-common/dist/networking/helpers';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { AccountContactContext } from '../components/accountContacts/accountContactContext';
import { PrehashPassword } from '../crypto/helpers';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../persistentToast';
import { InitDirectMessageCrypotPassword } from '../services/accountLogic/directMessages/directMessageManager';
import type { ClientServices } from '../services/clientServices';
import type { Connector, SocketIOConnectorFactory } from './socketio_connector';

export type LoginResponse = 'ok' | 'verificationRequired' | 'invalidToken' | 'unknownCredentials' | 'invalidSecondFactor';

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
		logout: undefined;
		accountChanged: { account: IDirectoryAccountInfo | null; character: IDirectoryCharacterConnectionInfo | null; };
		/** Directory connection state change event. */
		connectionState: IDirectoryClientArgument['connectionState'];
		/** Emitted when we receive a `somethingChanged` message from directory. */
		somethingChanged: readonly IDirectoryClientChangeEvents[];
	};
}, ServiceConfigBase>;

/** Class housing connection from Shard to Directory */
export class DirectoryConnector extends Service<DirectoryConnectorServiceConfig> implements IConnectionBase<IClientDirectory> {
	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryStatus = new Observable<IDirectoryStatus>(CreateDefaultDirectoryStatus());
	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);

	private readonly _directoryConnectionProgress = new PersistentToast();
	private readonly _authToken = BrowserStorage.create<AuthToken | undefined>('authToken', undefined, AuthTokenSchema);
	private readonly _lastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined, CharacterIdSchema.optional());

	/** Handler for second factor authentication */
	public secondFactorHandler: ((response: SecondFactorResponse) => Promise<SecondFactorData | null>) | null = null;

	private _shardConnectionInfo: IDirectoryCharacterConnectionInfo | null = null;

	/** Handlers for server messages. Dependent services are expected to fill those in. */
	public readonly messageHandlers: Partial<MessageHandlers<IDirectoryClient>> = {
		serverStatus: (status) => {
			this._directoryStatus.value = status;
		},
		connectionState: async (message: IDirectoryClientArgument['connectionState']) => {
			this.emit('connectionState', message);
			await this.handleAccountChange(message);
		},
		loginTokenChanged: (data) => {
			Assert(this._authToken.value);
			this._authToken.value = {
				value: data.value,
				expires: data.expires,
				username: this._authToken.value.username,
			};
		},
		somethingChanged: ({ changes }) => {
			this.emit('somethingChanged', changes);
		},
		friendStatus: (data) => AccountContactContext.handleFriendStatus(data),
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

	/** Currently logged in account data or null if not logged in */
	public get currentAccount(): ReadonlyObservable<IDirectoryAccountInfo | null> {
		return this._currentAccount;
	}

	/** Current auth token or undefined if not logged in */
	public get authToken(): ReadonlyObservable<AuthToken | undefined> {
		return this._authToken;
	}

	/** The Id of the last selected character for this session. On reconnect this character will be re-selected. */
	public get lastSelectedCharacter(): ReadonlyObservable<CharacterId | undefined> {
		return this._lastSelectedCharacter;
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
			friendStatus: true,
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
	 * @returns Promise of the connection
	 */
	public async connect(uri: string, connectorFactory: SocketIOConnectorFactory<IClientDirectory, IDirectoryClient, IClientDirectoryAuthMessage | undefined>): Promise<this> {
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

		await this._connector.connect();
		return this;
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
	 * Attempt to login to Directory and handle response
	 * @param username - The username to use for login
	 * @param password - The plaintext password to use for login
	 * @param verificationToken - Verification token to verify email
	 * @returns Promise of response from Directory
	 */
	public async login(username: string, password: string, verificationToken?: string): Promise<LoginResponse> {
		// Init DM crypto password before attempting login, so it can load directly at login
		await InitDirectMessageCrypotPassword(username, password);
		const passwordSha512 = await PrehashPassword(password);
		const result = await this.loginDirect({ username, passwordSha512, verificationToken });
		if (result !== 'ok') {
			await this.handleAccountChange({ account: null, character: null });
		}
		return result;
	}

	private async loginDirect(data: IClientDirectoryArgument['login']): Promise<LoginResponse> {
		const result = await this.awaitResponse('login', data);
		switch (result.result) {
			case 'ok':
				this._authToken.value = { ...result.token, username: result.account.username };
				await this.handleAccountChange({ account: result.account, character: null });
				return 'ok';
			case 'secondFactorRequired':
			case 'secondFactorInvalid':
				if (this.secondFactorHandler) {
					const secondFactor = await this.secondFactorHandler(result);
					if (secondFactor) {
						return this.loginDirect({ ...data, secondFactor });
					}
				}
				return 'invalidSecondFactor';
			default:
				return result.result;
		}
	}

	public logout(): void {
		this.sendMessage('logout', { type: 'self' });
		this.emit('connectionState', { account: null, character: null });
		this.emit('logout', undefined);
		AccountContactContext.handleLogout();
		this._lastSelectedCharacter.value = undefined;
		this._authToken.value = undefined;
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

	public setShardConnectionInfo(info: IDirectoryCharacterConnectionInfo): void {
		this._shardConnectionInfo = info;
		this.setActiveShardId(info.id);
	}

	private setActiveShardId(id?: string): void {
		Assert(this._connector != null);
		const extraHeaders = {
			[HTTP_HEADER_CLIENT_REQUEST_SHARD]: id || undefined,
		};
		this._connector.setExtraHeaders(extraHeaders);
	}

	private async handleAccountChange({ account, character }: { account: IDirectoryAccountInfo | null; character: IDirectoryCharacterConnectionInfo | null; }): Promise<void> {
		// Update current account
		this._currentAccount.value = account ? freeze(account) : null;
		// Clear saved token if no account
		if (!account) {
			this._authToken.value = undefined;
		} else {
			await AccountContactContext.initStatus(this);
			if (character === null) {
				// If we already have a character and we are requested to unload it, clear the last character
				if (this._shardConnectionInfo != null) {
					this._lastSelectedCharacter.value = undefined;
				} else {
					// Otherwise try to autoconnect
					await this.autoConnectCharacter();
				}
			} else {
				this._lastSelectedCharacter.value = character.characterId;
			}
		}
		this.emit('accountChanged', { account, character });
	}

	/**
	 * Get data to use to authenticate to Directory using socket.io auth mechanism
	 */
	private getAuthData(): IClientDirectoryAuthMessage | undefined {
		const token = this._authToken.value;
		const connectionInfo = this._shardConnectionInfo;
		if (token && token.expires > Date.now()) {
			return {
				username: token.username,
				token: token.value,
				character: connectionInfo ? {
					id: connectionInfo.characterId,
					secret: connectionInfo.secret,
				} : null,
			};
		} else {
			return undefined;
		}
	}

	@AsyncSynchronized()
	private async autoConnectCharacter(): Promise<void> {
		const characterId = this._lastSelectedCharacter.value;
		if (characterId == null || this._shardConnectionInfo != null) {
			return;
		}
		// Try to directly connect to the last selected character
		const data = await this.awaitResponse('connectCharacter', { id: characterId });
		if (data.result !== 'ok') {
			logger.alert('Failed to auto-connect to previous character:', data);
			this._lastSelectedCharacter.value = undefined;
		}
	}

	public async connectToCharacter(id: CharacterId): Promise<boolean> {
		const data = await this.awaitResponse('connectCharacter', { id });
		if (data.result !== 'ok') {
			logger.error('Failed to connect to character:', data);
			toast(`Failed to connect to character:\n${data.result}`, TOAST_OPTIONS_ERROR);
			this._lastSelectedCharacter.value = undefined;
			return false;
		}
		return true;
	}

	public disconnectFromCharacter(): void {
		this.sendMessage('disconnectCharacter', EMPTY);
		this._lastSelectedCharacter.value = undefined;
	}
}

export const DirectoryConnectorServiceProvider: ServiceProviderDefinition<ClientServices, 'directoryConnector', DirectoryConnectorServiceConfig> = {
	name: 'directoryConnector',
	ctor: DirectoryConnector,
	dependencies: {},
};
