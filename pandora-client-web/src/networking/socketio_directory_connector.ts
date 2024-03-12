import {
	ConnectionBase,
	GetLogger,
	HTTP_HEADER_CLIENT_REQUEST_SHARD,
	IClientDirectoryAuthMessage,
	IClientDirectory,
	IDirectoryAccountInfo,
	IDirectoryCharacterConnectionInfo,
	IDirectoryClientArgument,
	IDirectoryClient,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	MessageHandler,
	ClientDirectorySchema,
	DirectoryClientSchema,
	TypedEventEmitter,
	CreateDefaultDirectoryStatus,
	CharacterIdSchema,
	CharacterId,
	EMPTY,
	AsyncSynchronized,
	SecondFactorResponse,
	IClientDirectoryArgument,
	SecondFactorData,
	AssertNever,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { connect, Socket } from 'socket.io-client';
import { BrowserStorage } from '../browserStorage';
import { AccountContactContext } from '../components/accountContacts/accountContactContext';
import { PrehashPassword } from '../crypto/helpers';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast, TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../persistentToast';
import { DirectMessageManager } from './directMessageManager';
import { AuthToken, DirectoryConnectionState, DirectoryConnector, LoginResponse } from './directoryConnector';
import { freeze } from 'immer';
import { z } from 'zod';
import { toast } from 'react-toastify';

type SocketAuthCallback = (data?: IClientDirectoryAuthMessage) => void;

const logger = GetLogger('DirConn');

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
export class SocketIODirectoryConnector extends ConnectionBase<IClientDirectory, IDirectoryClient, Socket> implements DirectoryConnector {

	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryStatus = new Observable<IDirectoryStatus>(CreateDefaultDirectoryStatus());
	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);

	private readonly _changeEventEmitter = new DirectoryChangeEventEmitter();
	private readonly _connectionStateEventEmitter = new ConnectionStateEventEmitter();

	private readonly _directoryConnectionProgress = new PersistentToast();
	private readonly _authToken = BrowserStorage.create<AuthToken | undefined>('authToken', undefined, AuthTokenSchema);
	private readonly _lastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined, CharacterIdSchema.optional());

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

	public get authToken(): ReadonlyObservable<AuthToken | undefined> {
		return this._authToken;
	}

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

	private constructor(socket: Socket) {
		super(socket, [ClientDirectorySchema, DirectoryClientSchema], logger);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

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
			somethingChanged: ({ changes }) => this._changeEventEmitter.onSomethingChanged(changes),
			directMessageSent: async (data) => {
				await this.directMessageHandler.handleDirectMessageSent(data);
			},
			directMessageGet: async (data) => {
				await this.directMessageHandler.handleDirectMessageGet(data);
			},
			directMessageAction: (data) => {
				this.directMessageHandler.handleDirectMessageAction(data);
			},
			friendStatus: (data) => AccountContactContext.handleFriendStatus(data),
			accountContactUpdate: (data) => AccountContactContext.handleAccountContactUpdate(data),
		});
		this.socket.onAny(this.handleMessage.bind(this));
	}

	protected onMessage<K extends keyof IDirectoryClient>(
		messageType: K,
		message: SocketInterfaceRequest<IDirectoryClient>[K],
	): Promise<SocketInterfaceResponse<IDirectoryClient>[K]> {
		return this._messageHandler.onMessage(messageType, message, undefined);
	}

	public static create(uri: string): SocketIODirectoryConnector {
		// eslint-disable-next-line prefer-const
		let directoryConnector: SocketIODirectoryConnector;
		// Create the connection without connecting
		const socket = connect(uri, {
			autoConnect: false,
			auth: (callback: SocketAuthCallback) => callback(directoryConnector.getAuthData()),
			withCredentials: true,
		});
		directoryConnector = new SocketIODirectoryConnector(socket);
		return directoryConnector;
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 * @returns Promise of the connection
	 */
	public connect(): Promise<this> {
		return new Promise((resolve) => {
			if (this._state.value !== DirectoryConnectionState.NONE) {
				throw new Error('connect can only be called once');
			}

			this.setState(DirectoryConnectionState.INITIAL_CONNECTION_PENDING);
			// Initial connection has shorter timeout
			this.socket.once('connect', () => {
				resolve(this);
			});
			// Attempt to connect
			this.socket.connect();
		});
	}

	/** Disconnect from Directory */
	public disconnect(): void {
		if (this._state.value === DirectoryConnectionState.NONE) {
			this.setState(DirectoryConnectionState.DISCONNECTED);
			return;
		}
		if (this._state.value === DirectoryConnectionState.DISCONNECTED)
			return;
		this.socket.close();
		this.setState(DirectoryConnectionState.DISCONNECTED);
		logger.info('Disconnected from Directory');
	}

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
	private onDisconnect(reason: Socket.DisconnectReason) {
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

	public setShardConnectionInfo(info: IDirectoryCharacterConnectionInfo | null): void {
		this._shardConnectionInfo = info;
		this.setActiveShardId(info?.id);
	}

	private setActiveShardId(id?: string): void {
		const extraHeaders = this.socket.io.opts.extraHeaders ?? {};
		if (id) {
			extraHeaders[HTTP_HEADER_CLIENT_REQUEST_SHARD] = id;
		} else {
			delete extraHeaders[HTTP_HEADER_CLIENT_REQUEST_SHARD];
		}
		this.socket.io.opts.extraHeaders = extraHeaders;
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

	public async extendAuthToken(password: string): Promise<void> {
		const username = this._authToken.value?.username;
		if (!username) {
			throw new Error('Not logged in');
		}
		const passwordSha512 = await PrehashPassword(password);
		const response = await this.awaitResponse('extendLoginToken', { passwordSha512 });
		switch (response.result) {
			case 'ok':
				this._authToken.value = {
					username,
					value: response.token,
					expires: response.expires,
				};
				toast('Session extended', TOAST_OPTIONS_SUCCESS);
				break;
			case 'invalidPassword':
				toast('Invalid password', TOAST_OPTIONS_ERROR);
				break;
			default:
				AssertNever(response);
		}
	}
}
