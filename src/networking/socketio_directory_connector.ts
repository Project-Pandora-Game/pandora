import {
	CharacterId,
	ConnectionBase,
	CreateMessageHandlerOnAny,
	EMPTY,
	GetLogger,
	HTTP_HEADER_CLIENT_REQUEST_SHARD,
	IClientDirectoryBase,
	IDirectoryClientBase,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	MessageHandler,
} from 'pandora-common';
import { toast } from 'react-toastify';
import { connect, Socket } from 'socket.io-client';
import { DIRECTORY_ADDRESS } from '../config/Environment';
import { TypedEventEmitter } from '../event';
import { Observable, ReadonlyObservable } from '../observable';
import { PersistentToast } from '../persistentToast';
import { GetAuthData, HandleDirectoryConnectionState } from './account_manager';
import { DirectoryConnectionState, IDirectoryConnector } from './directoryConnector';
import { ConnectToShard } from './socketio_shard_connector';

const logger = GetLogger('DirConn');

class DirectoryChangeEventEmitter extends TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> {
	onSomethingChanged(changes: IDirectoryClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
}

/** Class housing connection from Shard to Directory */
export class SocketIODirectoryConnector extends ConnectionBase<Socket, IClientDirectoryBase> implements IDirectoryConnector {

	private readonly _state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);
	private readonly _directoryStatus = new Observable<IDirectoryStatus>({
		time: Date.now(),
	});
	private readonly _changeEventEmitter = new DirectoryChangeEventEmitter();
	private readonly _directoryConnectionProgress = new PersistentToast();

	/** Current state of the connection */
	get state(): ReadonlyObservable<DirectoryConnectionState> {
		return this._state;
	}

	/** Directory status data */
	get directoryStatus(): ReadonlyObservable<IDirectoryStatus> {
		return this._directoryStatus;
	}

	/** Event emitter for directory change events */
	get changeEventEmitter(): TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> {
		return this._changeEventEmitter;
	}

	constructor(uri: string) {
		super(CreateConnection(uri), logger);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		// Setup message handler
		const handler = new MessageHandler<IDirectoryClientBase>({}, {
			serverStatus: (status) => {
				this._directoryStatus.value = status;
			},
			connectionState: HandleDirectoryConnectionState,
			somethingChanged: ({ changes }) => this._changeEventEmitter.onSomethingChanged(changes),
		});
		this.socket.onAny(CreateMessageHandlerOnAny(logger, handler.onMessage.bind(handler)));
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 * @returns Promise of the connection
	 */
	public connect(): Promise<this> {
		return new Promise((resolve) => {
			if (!DIRECTORY_ADDRESS) {
				throw new Error('Missing DIRECTORY_ADDRESS');
			}

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

	public async createNewCharacter(): Promise<boolean> {
		const data = await this.awaitResponse('createCharacter', EMPTY);
		if (data.result !== 'ok') {
			logger.error('Failed to create character:', data);
			toast(`Failed to create character:\n${data.result}`, {
				type: 'error',
				autoClose: 10_000,
				closeOnClick: true,
				closeButton: true,
				draggable: true,
			});
			return false;
		}
		await ConnectToShard(data);
		return true;
	}

	public async connectToCharacter(id: CharacterId): Promise<boolean> {
		const data = await this.awaitResponse('connectCharacter', { id });
		if (data.result !== 'ok') {
			logger.error('Failed to connect to character:', data);
			toast(`Failed to connect to character:\n${data.result}`, {
				type: 'error',
				autoClose: 10_000,
				closeOnClick: true,
				closeButton: true,
				draggable: true,
			});
			return false;
		}
		await ConnectToShard(data);
		return true;
	}

	public setActiveShardId(id?: string): void {
		const extraHeaders = this.socket.io.opts.extraHeaders ?? {};
		if (id) {
			extraHeaders[HTTP_HEADER_CLIENT_REQUEST_SHARD] = id;
		} else {
			delete extraHeaders[HTTP_HEADER_CLIENT_REQUEST_SHARD];
		}
		this.socket.io.opts.extraHeaders = extraHeaders;
	}
}

export const DirectoryConnector = new SocketIODirectoryConnector(DIRECTORY_ADDRESS);

function CreateConnection(uri: string): Socket {
	// Create the connection without connecting
	return connect(uri, {
		autoConnect: false,
		auth: GetAuthData,
		withCredentials: true,
	});
}
