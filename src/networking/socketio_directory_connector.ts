import { DIRECTORY_ADDRESS } from '../config/Environment';
import { GetLogger } from 'pandora-common';
import { Connection, IClientDirectoryBase, MessageHandler, IDirectoryClientBase, CreateMassageHandlerOnAny } from 'pandora-common';
import { connect, Socket } from 'socket.io-client';

const logger = GetLogger('DirConn');

// Setup message handler
const handler = new MessageHandler<IDirectoryClientBase>({}, {
	connectionState: () => { /* TODO */ },
});

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

function CreateConnection(uri: string): Socket {
	// Create the connection without connecting
	return connect(uri, {
		autoConnect: false,
		withCredentials: true,
	});
}

/** Class housing connection from Shard to Directory */
export class SocketIODirectoryConnector extends Connection<Socket, IClientDirectoryBase> {

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

		this.socket.onAny(CreateMassageHandlerOnAny(logger, handler.onMessage.bind(handler)));
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
		this._state = newState;
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
}

export const DirectoryConnector = new SocketIODirectoryConnector(DIRECTORY_ADDRESS);

export function ConnectToDirectory(): Promise<SocketIODirectoryConnector> {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Missing DIRECTORY_ADDRESS');
	}
	// Start
	return DirectoryConnector.connect();
}
