import { freeze } from 'immer';
import {
	Assert,
	AsyncSynchronized,
	CharacterId,
	CharacterIdSchema,
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
	MessageHandler,
	SecondFactorData,
	SecondFactorResponse,
	TypedEventEmitter,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse, type SocketInterfaceOneshotMessages, type SocketInterfaceRespondedMessages } from 'pandora-common/dist/networking/helpers';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { AccountContactContext } from '../components/accountContacts/accountContactContext';
import { PrehashPassword } from '../crypto/helpers';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../persistentToast';
import { DirectMessageManager } from '../services/accountLogic/directMessages/directMessageManager';
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

class DirectoryChangeEventEmitter extends TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> {
	public onSomethingChanged(changes: IDirectoryClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
}

class ConnectionStateEventEmitter extends TypedEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>> {
	public onStateChanged(data: IDirectoryClientArgument['connectionState']): void {
		this.emit('connectionState', data);
	}
}

const AuthTokenSchema = z.object({
	value: z.string(),
	username: z.string(),
	expires: z.number().refine((n) => n > Date.now(), { message: 'Token has expired' }),
}).optional();

/** Class housing connection from Shard to Directory */
export class DirectoryConnector implements IConnectionBase<IClientDirectory> {
	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryStatus = new Observable<IDirectoryStatus>(CreateDefaultDirectoryStatus());
	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);

	private readonly _changeEventEmitter = new DirectoryChangeEventEmitter();
	private readonly _connectionStateEventEmitter = new ConnectionStateEventEmitter();

	private readonly _directoryConnectionProgress = new PersistentToast();
	private readonly _authToken = BrowserStorage.create<AuthToken | undefined>('authToken', undefined, AuthTokenSchema);
	private readonly _lastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined, CharacterIdSchema.optional());

	/** Handler for second factor authentication */
	public secondFactorHandler: ((response: SecondFactorResponse) => Promise<SecondFactorData | null>) | null = null;

	private _shardConnectionInfo: IDirectoryCharacterConnectionInfo | null = null;

	private readonly _messageHandler: MessageHandler<IDirectoryClient>;
	public readonly directMessageHandler: DirectMessageManager;

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

	/** Event emitter for directory change events */
	public get changeEventEmitter(): TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> {
		return this._changeEventEmitter;
	}

	/** Event emitter for directory connection state change events */
	public get connectionStateEventEmitter(): TypedEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>> {
		return this._connectionStateEventEmitter;
	}

	private _connector: Connector<IClientDirectory> | null = null;

	constructor() {
		this.directMessageHandler = new DirectMessageManager(this);

		// Setup message handler
		this._messageHandler = new MessageHandler<IDirectoryClient>({
			serverStatus: (status) => {
				this._directoryStatus.value = status;
			},
			connectionState: async (message: IDirectoryClientArgument['connectionState']) => {
				this._connectionStateEventEmitter.onStateChanged(message);
				await this.handleAccountChange(message);
				await this.directMessageHandler.accountChanged();
			},
			loginTokenChanged: (data) => {
				Assert(this._authToken.value);
				this._authToken.value = {
					value: data.value,
					expires: data.expires,
					username: this._authToken.value.username,
				};
			},
			somethingChanged: ({ changes }) => this._changeEventEmitter.onSomethingChanged(changes),
			directMessageNew: ({ target, message }) => {
				this.directMessageHandler.handleNewDirectMessage(target, message);
			},
			directMessageAction: (data) => {
				this.directMessageHandler.handleDirectMessageAction(data);
			},
			friendStatus: (data) => AccountContactContext.handleFriendStatus(data),
			accountContactUpdate: (data) => AccountContactContext.handleAccountContactUpdate(data),
		});
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
		const passwordSha512 = await PrehashPassword(password);
		const result = await this.loginDirect({ username, passwordSha512, verificationToken });
		if (result === 'ok') {
			await this.directMessageHandler.initCryptoPassword(username, password);
		} else {
			await this.handleAccountChange({ account: null, character: null });
		}
		await this.directMessageHandler.accountChanged();
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
		this._connectionStateEventEmitter.onStateChanged({ account: null, character: null });
		this.directMessageHandler.clear();
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
