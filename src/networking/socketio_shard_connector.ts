import { CharacterId, GetLogger, ShardInfo } from 'pandora-common';
import { Connection, IClientShardBase, MessageHandler, IShardClientBase, CreateMessageHandlerOnAny } from 'pandora-common';
import { connect, Socket } from 'socket.io-client';
import Player from '../character/player';

const logger = GetLogger('ShardConn');

// Setup message handler
const handler = new MessageHandler<IShardClientBase>({}, {
	loadCharacter: Player.load.bind(Player),
	updateCharacter: Player.update.bind(Player),
});

/** State of connection to Shard */
export enum ShardConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Shard for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection to Shard is currently established */
	CONNECTED,
	/** Connection to Shard lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

function CreateConnection(characterId: CharacterId, { publicURL, secret }: ShardInfo): Socket {
	// Create the connection without connecting
	return connect(publicURL, {
		autoConnect: false,
		withCredentials: true,
		extraHeaders: {
			authorization: `${characterId} ${secret}`,
		},
	});
}

/** Class housing connection from Shard to Shard */
export class SocketIOShardConnector extends Connection<Socket, IClientShardBase> {

	/** Current state of the connection */
	private _state: ShardConnectionState = ShardConnectionState.NONE;
	/** Current state of the connection */
	get state(): ShardConnectionState {
		return this._state;
	}

	constructor(characterId: CharacterId, info: ShardInfo) {
		super(CreateConnection(characterId, info), logger);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		this.socket.onAny(CreateMessageHandlerOnAny(logger, handler.onMessage.bind(handler)));
	}

	/**
	 * Attempt a connection
	 *
	 * **can only be used once**
	 * @returns Promise of the connection
	 */
	public connect(): Promise<this> {
		if (this._state !== ShardConnectionState.NONE) {
			throw new Error('connect can only be called once');
		}
		return new Promise((resolve) => {
			this.setState(ShardConnectionState.INITIAL_CONNECTION_PENDING);
			// Initial connection has shorter timeout
			this.socket.once('connect', () => {
				resolve(this);
			});
			// Attempt to connect
			this.socket.connect();
		});
	}

	/** Disconnect from Shard */
	public disconnect(): void {
		if (this._state === ShardConnectionState.NONE) {
			this.setState(ShardConnectionState.DISCONNECTED);
			return;
		}
		if (this._state === ShardConnectionState.DISCONNECTED)
			return;
		this.socket.close();
		this.setState(ShardConnectionState.DISCONNECTED);
		logger.info('Disconnected from Shard');
	}

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ShardConnectionState): void {
		this._state = newState;
	}

	/** Handle successful connection to Shard */
	private onConnect(): void {
		if (this._state === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ShardConnectionState.CONNECTED);
			logger.info('Connected to Shard');
		} else if (this._state === ShardConnectionState.CONNECTION_LOST) {
			this.setState(ShardConnectionState.CONNECTED);
			logger.alert('Re-Connected to Shard');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', ShardConnectionState[this._state]);
		}
	}

	/** Handle loss of connection to Shard */
	private onDisconnect(reason: Socket.DisconnectReason) {
		// If the disconnect was requested, just ignore this
		if (this._state === ShardConnectionState.DISCONNECTED)
			return;
		if (this._state === ShardConnectionState.CONNECTED) {
			this.setState(ShardConnectionState.CONNECTION_LOST);
			logger.alert('Lost connection to Shard:', reason);
		} else {
			logger.fatal('Assertion failed: received \'disconnect\' event when in state:', ShardConnectionState[this._state]);
		}
	}

	/** Handle failed connection attempt */
	private onConnectError(err: Error) {
		logger.warning('Connection to Shard failed:', err.message);
	}
}

export function ConnectToShard(characterId: CharacterId, info: ShardInfo): Promise<SocketIOShardConnector> {
	const connector = new SocketIOShardConnector(characterId, info);
	// Start
	return connector.connect();
}
