import { GetLogger, IDirectoryCharacterConnectionInfo, IShardClientArgument, ConnectionBase, IClientShardBase, MessageHandler, IShardClientBase, CreateMessageHandlerOnAny } from 'pandora-common';
import { toast, ToastOptions } from 'react-toastify';
import { connect, Socket } from 'socket.io-client';
import { Player } from '../character/player';
import { Room } from '../character/room';
import { Observable } from '../observable';

const logger = GetLogger('ShardConn');

export const ShardConnector = new Observable<SocketIOShardConnector | null>(null);

/** State of connection to Shard */
export enum ShardConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Shard for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection is waiting for shard to send initial data */
	WAIT_FOR_DATA,
	/** Connection to Shard is currently established */
	CONNECTED,
	/** Connection to Shard lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

function CreateConnection({ publicURL, secret, characterId }: IDirectoryCharacterConnectionInfo): Socket {
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
export class SocketIOShardConnector extends ConnectionBase<Socket, IClientShardBase> {

	/** Current state of the connection */
	private _state: ShardConnectionState = ShardConnectionState.NONE;
	/** Current state of the connection */
	get state(): ShardConnectionState {
		return this._state;
	}

	readonly connectionInfo: Readonly<IDirectoryCharacterConnectionInfo>;

	private loadResolver: ((arg: this) => void) | null = null;

	constructor(info: IDirectoryCharacterConnectionInfo) {
		super(CreateConnection(info), logger);
		this.connectionInfo = info;

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		// Setup message handler
		const handler = new MessageHandler<IShardClientBase>({}, {
			load: this.onLoad.bind(this),
			updateCharacter: Player.update.bind(Player),
			chatRoomUpdate: this.onChatRoomUpdate.bind(this),
			chatRoomMessage: (message: IShardClientArgument['chatRoomMessage']) => {
				Room.onMessage(message);
			},
		});
		this.socket.onAny(CreateMessageHandlerOnAny(logger, handler.onMessage.bind(handler)));
	}

	public connectionInfoMatches(info: IDirectoryCharacterConnectionInfo): boolean {
		return this.connectionInfo.id === info.id &&
			this.connectionInfo.publicURL === info.publicURL &&
			// this.connectionInfo.features === info.features &&
			this.connectionInfo.version === info.version &&
			this.connectionInfo.characterId === info.characterId &&
			this.connectionInfo.secret === info.secret;
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
			this.loadResolver = resolve;
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

	private toastId: string | number | null = null;

	/**
	 * Sets a new state, updating all dependent things
	 * @param newState The state to set
	 */
	private setState(newState: ShardConnectionState): void {
		this._state = newState;

		let options: ToastOptions = {
			isLoading: false,
			autoClose: 2_000,
			hideProgressBar: true,
			closeOnClick: true,
			closeButton: true,
			draggable: true,
		};
		const optionsPending: ToastOptions = {
			type: 'default',
			isLoading: true,
			autoClose: false,
			closeOnClick: false,
			closeButton: false,
			draggable: false,
		};
		let render = '';
		if (newState === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			options = optionsPending;
			render = 'Connecting to Shard...';
		} else if (newState === ShardConnectionState.WAIT_FOR_DATA) {
			options = optionsPending;
			render = 'Loading Shard data...';
		} else if (newState === ShardConnectionState.CONNECTED) {
			options.type = 'success';
			render = 'Connected to Shard';
		} else if (newState === ShardConnectionState.CONNECTION_LOST) {
			options = optionsPending;
			render = 'Shard connection lost\nReconnecting...';
		}

		if (this.toastId !== null) {
			if (render) {
				toast.update(this.toastId, {
					...options,
					render,
				});
			} else {
				toast.dismiss(this.toastId);
				this.toastId = null;
			}
		} else if (render) {
			this.toastId = toast(render, {
				...options,
				onClose: () => {
					this.toastId = null;
				},
			});
		}
	}

	/** Handle successful connection to Shard */
	private onConnect(): void {
		if (this._state === ShardConnectionState.INITIAL_CONNECTION_PENDING) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
			logger.info('Connected to Shard');
		} else if (this._state === ShardConnectionState.CONNECTION_LOST) {
			this.setState(ShardConnectionState.WAIT_FOR_DATA);
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

	private onLoad({ character, room }: IShardClientArgument['load']): void {
		Player.load(character);
		Room.update(room);
		if (this._state === ShardConnectionState.WAIT_FOR_DATA) {
			this.setState(ShardConnectionState.CONNECTED);
			if (this.loadResolver) {
				this.loadResolver(this);
				this.loadResolver = null;
			}
			logger.info('Received initial character data');
		} else {
			logger.fatal('Assertion failed: received \'load\' event when in state:', ShardConnectionState[this._state]);
		}
	}

	private onChatRoomUpdate({ room }: IShardClientArgument['chatRoomUpdate']): void {
		Room.update(room);
	}
}

export function DisconnectFromShard(): void {
	if (ShardConnector.value) {
		ShardConnector.value.disconnect();
		ShardConnector.value = null;
		Player.unload();
	}
}

export function ConnectToShard(info: IDirectoryCharacterConnectionInfo): Promise<SocketIOShardConnector> {
	if (ShardConnector.value?.connectionInfoMatches(info))
		return Promise.resolve(ShardConnector.value);
	DisconnectFromShard();
	const connector = new SocketIOShardConnector(info);
	ShardConnector.value = connector;
	// Start
	return connector.connect();
}
