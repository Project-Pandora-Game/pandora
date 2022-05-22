import { toast } from 'react-toastify';
import { DIRECTORY_ADDRESS } from '../config/Environment';
import { EMPTY, GetLogger, ICharacterSelfInfo, IDirectoryClientChangeEvents, ConnectionBase, IClientDirectoryBase, MessageHandler, IDirectoryClientBase, CreateMessageHandlerOnAny, HTTP_HEADER_CLIENT_REQUEST_SHARD } from 'pandora-common';
import { GetAuthData, HandleDirectoryConnectionState } from './account_manager';
import { connect, Socket } from 'socket.io-client';
import { ConnectToShard } from './socketio_shard_connector';
import { TypedEventEmitter } from '../event';
import { PersistentToast } from '../persistentToast';

const logger = GetLogger('DirConn');

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

export const ChangeEventEmmiter = new class ChangeEventEmmiter extends TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> {
	onSomethingChanged(changes: IDirectoryClientChangeEvents[]): void {
		changes.forEach((change) => this.emit(change, true));
	}
};

function CreateConnection(uri: string): Socket {
	// Create the connection without connecting
	return connect(uri, {
		autoConnect: false,
		auth: GetAuthData,
		withCredentials: true,
	});
}

const DirectoryConnectionProgress = new PersistentToast();

/** Class housing connection from Shard to Directory */
export class SocketIODirectoryConnector extends ConnectionBase<Socket, IClientDirectoryBase> {

	/** Current state of the connection */
	private _state: DirectoryConnectionState = DirectoryConnectionState.NONE;
	/** Current state of the connection */
	get state(): DirectoryConnectionState {
		return this._state;
	}

	constructor(uri: string) {
		super(CreateConnection(uri), logger);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		// Setup message handler
		const handler = new MessageHandler<IDirectoryClientBase>({}, {
			connectionState: HandleDirectoryConnectionState,
			somethingChanged: ({ changes }) => ChangeEventEmmiter.onSomethingChanged(changes),
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
		if (this._state !== DirectoryConnectionState.NONE) {
			throw new Error('connect can only be called once');
		}
		return new Promise((resolve) => {
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
		if (this._state === DirectoryConnectionState.NONE) {
			this.setState(DirectoryConnectionState.DISCONNECTED);
			return;
		}
		if (this._state === DirectoryConnectionState.DISCONNECTED)
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
		const initial = this._state === DirectoryConnectionState.INITIAL_CONNECTION_PENDING;
		this._state = newState;

		if (newState === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			DirectoryConnectionProgress.show('progress', 'Connecting to Directory...');
		} else if (newState === DirectoryConnectionState.CONNECTED) {
			DirectoryConnectionProgress.show('success', initial ? 'Connected to Directory' : 'Reconnected to Directory');
		} else if (newState === DirectoryConnectionState.CONNECTION_LOST) {
			DirectoryConnectionProgress.show('progress', 'Directory connection lost\nReconnecting...');
		} else if (newState === DirectoryConnectionState.DISCONNECTED) {
			DirectoryConnectionProgress.hide();
		}
	}

	/** Handle successful connection to Directory */
	private onConnect(): void {
		if (this._state === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(DirectoryConnectionState.CONNECTED);
			logger.info('Connected to Directory');
		} else if (this._state === DirectoryConnectionState.CONNECTION_LOST) {
			this.setState(DirectoryConnectionState.CONNECTED);
			logger.alert('Re-Connected to Directory');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', DirectoryConnectionState[this._state]);
		}
	}

	/** Handle loss of connection to Directory */
	private onDisconnect(reason: Socket.DisconnectReason) {
		// If the disconnect was requested, just ignore this
		if (this._state === DirectoryConnectionState.DISCONNECTED)
			return;
		if (this._state === DirectoryConnectionState.CONNECTED) {
			this.setState(DirectoryConnectionState.CONNECTION_LOST);
			logger.alert('Lost connection to Directory:', reason);
		} else {
			logger.fatal('Assertion failed: received \'disconnect\' event when in state:', DirectoryConnectionState[this._state]);
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

	public async connectToCharacter(id: ICharacterSelfInfo['id']): Promise<boolean> {
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

	public setActiveShardId(id: string | undefined): void {
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

export function ConnectToDirectory(): Promise<SocketIODirectoryConnector> {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Missing DIRECTORY_ADDRESS');
	}
	// Start
	return DirectoryConnector.connect();
}
