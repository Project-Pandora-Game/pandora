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
	IsObject,
	IsString,
	MessageHandler,
	ClientDirectorySchema,
	DirectoryClientSchema,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { connect, Socket } from 'socket.io-client';
import { BrowserStorage } from '../browserStorage';
import { FRIEND_STATUS, RELATIONSHIPS } from '../components/releationships/relationships';
import { PrehashPassword } from '../crypto/helpers';
import { TypedEventEmitter } from '../event';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast } from '../persistentToast';
import { DirectMessageManager } from './directMessageManager';
import { AuthToken, DirectoryConnectionState, DirectoryConnector, LoginResponse } from './directoryConnector';

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

/** Class housing connection from Shard to Directory */
export class SocketIODirectoryConnector extends ConnectionBase<IClientDirectory, IDirectoryClient, Socket> implements DirectoryConnector {

	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryStatus = new Observable<IDirectoryStatus>({
		time: Date.now(),
	});
	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);

	private readonly _changeEventEmitter = new DirectoryChangeEventEmitter();
	private readonly _connectionStateEventEmitter = new ConnectionStateEventEmitter();

	private readonly _directoryConnectionProgress = new PersistentToast();
	private readonly _authToken = BrowserStorage.create<AuthToken | undefined>('authToken', undefined, (value) => {
		return IsObject(value) && IsString(value.value) && typeof value.expires === 'number' && value.expires > Date.now();
	});

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
				this.handleAccountChange(message.account);
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
			friendStatus: (data) => {
				const filtered = FRIEND_STATUS.value.filter((status) => status.id !== data.id);
				if ('online' in data) {
					filtered.push(data);
				}
				FRIEND_STATUS.value = filtered;
			},
			relationshipsUpdate: (data) => {
				const filtered = RELATIONSHIPS.value.filter((relationship) => relationship.id !== data.id);
				if ('name' in data) {
					filtered.push(data);
				}
				RELATIONSHIPS.value = filtered;
			},
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
		const result = await this.awaitResponse('login', { username, passwordSha512, verificationToken });

		if (result.result === 'ok') {
			this._authToken.value = { ...result.token, username: result.account.username };
			RELATIONSHIPS.value = result.relationships;
			FRIEND_STATUS.value = result.friends;
			await this.directMessageHandler.initCryptoPassword(username, password);
			this.handleAccountChange(result.account);
		} else {
			this.handleAccountChange(null);
		}
		await this.directMessageHandler.accountChanged();
		return result.result;
	}

	public logout(): void {
		this.sendMessage('logout', { invalidateToken: this._authToken.value?.value });
		this._connectionStateEventEmitter.onStateChanged({ account: null, character: null });
		this.directMessageHandler.clear();
		RELATIONSHIPS.value = [];
		FRIEND_STATUS.value = [];
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

	private handleAccountChange(account: IDirectoryAccountInfo | null): void {
		// Update current account
		this._currentAccount.value = account;
		// Clear saved token if no account
		if (!account) {
			this._authToken.value = undefined;
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
}
