import { DIRECTORY_ADDRESS, SHARD_SHARED_SECRET } from '../config';
import { GetLogger, logConfig } from '../logging';
import { HTTP_HEADER_SHARD_SECRET, HTTP_SOCKET_IO_SHARD_PATH } from 'pandora-common';
import { connect, Socket } from 'socket.io-client';

/** Time in milliseconds after which should attempt to connect to Directory fail */
const INITIAL_CONNECT_TIMEOUT = 10_000;

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

/** Class housing connection from Shard to Directory */
export class DirectoryConnection {
	/** The socket for connection */
	private readonly connection: Socket;

	/** Current state of the connection */
	private _state: DirectoryConnectionState = DirectoryConnectionState.NONE;
	/** Current state of the connection */
	get state(): DirectoryConnectionState {
		return this._state;
	}

	constructor(uri: string, secret: string = '') {
		// Build headers for connection
		const extraHeaders: Record<string, string> = {};
		if (secret) {
			extraHeaders[HTTP_HEADER_SHARD_SECRET] = secret;
		}
		// Create the connection without connecting
		this.connection = connect(uri, {
			autoConnect: false,
			extraHeaders,
			path: HTTP_SOCKET_IO_SHARD_PATH,
			transports: ['websocket'],
			rejectUnauthorized: true,
			withCredentials: true,
		});
		// Setup event handlers
		this.connection.on('connect', this.onConnect.bind(this));
		this.connection.on('disconnect', this.onDisconnect.bind(this));
		this.connection.on('connect_error', this.onConnectError.bind(this));
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
		return new Promise((resolve, reject) => {
			this._state = DirectoryConnectionState.INITIAL_CONNECTION_PENDING;
			// Initial connection has shorter timeout
			const timeout = setTimeout(() => {
				this.disconnect();
				reject('Connection timed out');
			}, INITIAL_CONNECT_TIMEOUT).unref();
			this.connection.once('connect', () => {
				clearTimeout(timeout);
				resolve(this);
			});
			// Attempt to connect
			this.connection.connect();
		});
	}

	/** Disconnect from Directory */
	public disconnect(): void {
		if (this._state === DirectoryConnectionState.NONE) {
			this._state = DirectoryConnectionState.DISCONNECTED;
			return;
		}
		if (this._state === DirectoryConnectionState.DISCONNECTED)
			return;
		this.connection.close();
		this._state = DirectoryConnectionState.DISCONNECTED;
		logger.info('Disconnected from Directory');
	}

	/** Handle successful connection to Directory */
	private onConnect(): void {
		if (this._state === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			this._state = DirectoryConnectionState.CONNECTED;
			logger.info('Connected to Directory');
		} else if (this._state === DirectoryConnectionState.CONNECTION_LOST) {
			this._state = DirectoryConnectionState.CONNECTED;
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
			this._state = DirectoryConnectionState.CONNECTION_LOST;
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

export function ConnectToDirectory(): Promise<DirectoryConnection> {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Missing DIRECTORY_ADDRESS');
	}
	// Create the connection
	const connection = new DirectoryConnection(DIRECTORY_ADDRESS, SHARD_SHARED_SECRET);
	// Setup shutdown handlers
	logConfig.onFatal.push(() => {
		connection.disconnect();
	});
	// Start
	return connection.connect();
}
