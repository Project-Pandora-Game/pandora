import {
	AsyncSynchronized,
	ConnectionBase,
	DirectoryShardSchema,
	GetLogger,
	HTTP_HEADER_SHARD_SECRET,
	HTTP_SOCKET_IO_SHARD_PATH,
	IDirectoryShard,
	IDirectoryShardArgument,
	IDirectoryShardResult,
	IDirectoryShardUpdate,
	IShardDirectory,
	MessageHandler,
	PANDORA_VERSION_DATABASE,
	ShardDirectorySchema,
	ShardFeature,
	SpaceIdSchema,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import promClient from 'prom-client';
import { connect, Socket } from 'socket.io-client';
import { CharacterManager } from '../character/characterManager.ts';
import { APP_VERSION, ENV } from '../config.ts';
import { Stop } from '../lifecycle.ts';
import { SpaceManager } from '../spaces/spaceManager.ts';
const { DIRECTORY_ADDRESS, SERVER_PUBLIC_ADDRESS, SHARD_DEVELOPMENT_MODE, SHARD_SHARED_SECRET } = ENV;

/** Time in milliseconds after which should attempt to connect to Directory fail */
const INITIAL_CONNECT_TIMEOUT = 60_000;

const logger = GetLogger('DirectoryConnector');

/** State of connection to Directory */
export enum DirectoryConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Directory for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Attempting to register with directory (both on connect and reconnect) */
	REGISTRATION_PENDING,
	/** Connection to Directory is currently established */
	CONNECTED,
	/** Connection to Directory lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

function CreateConnection(uri: string, secret: string = ''): Socket {
	// Build headers for connection
	const extraHeaders: Record<string, string> = {};
	if (secret) {
		extraHeaders[HTTP_HEADER_SHARD_SECRET] = secret;
	}
	// Create the connection without connecting
	return connect(uri, {
		autoConnect: false,
		extraHeaders,
		path: HTTP_SOCKET_IO_SHARD_PATH,
		transports: ['websocket'],
		rejectUnauthorized: true,
		withCredentials: true,
	});
}

const messagesMetric = new promClient.Counter({
	name: 'pandora_shard_directory_messages',
	help: 'Count of received messages from directory',
	labelNames: ['messageType'],
});

/** Class housing connection from Shard to Directory */
export class SocketIODirectoryConnector extends ConnectionBase<IShardDirectory, IDirectoryShard, Socket> {

	/** Current state of the connection */
	private _state: DirectoryConnectionState = DirectoryConnectionState.NONE;
	private readonly _messageHandler: MessageHandler<IDirectoryShard>;
	/** Current state of the connection */
	public get state(): DirectoryConnectionState {
		return this._state;
	}

	public shardId: string | undefined;

	constructor(uri: string, secret: string = '') {
		super(CreateConnection(uri, secret), [ShardDirectorySchema, DirectoryShardSchema], logger);

		// Setup event handlers
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('connect_error', this.onConnectError.bind(this));

		// Setup message handler
		this._messageHandler = new MessageHandler<IDirectoryShard>({
			update: (update) => this.updateFromDirectory(update).then(() => ({})),
			stop: Stop,
			spaceCheckCanLeave: this.handleSpaceCheckCanLeave.bind(this),
			spaceSwitchPermissionCheck: this.handleSpaceSwitchPermissionCheck.bind(this),
		});
		this.socket.onAny(this.handleMessage.bind(this));
	}

	protected onMessage<K extends keyof IDirectoryShard>(
		messageType: K,
		message: SocketInterfaceRequest<IDirectoryShard>[K],
	): Promise<SocketInterfaceResponse<IDirectoryShard>[K]> {
		messagesMetric.inc({ messageType });
		return this._messageHandler.onMessage(messageType, message, undefined);
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
			// Initial connection has shorter timeout (ignored in development mode)
			let timeout: NodeJS.Timeout | undefined;
			if (!SHARD_DEVELOPMENT_MODE) {
				timeout = setTimeout(() => {
					this.disconnect();
					reject(new Error('Connection timed out'));
				}, INITIAL_CONNECT_TIMEOUT).unref();
			}
			this.socket.once('connect', () => {
				if (timeout != null) {
					clearTimeout(timeout);
					timeout = undefined;
				}
				resolve(this);
			});
			// Attempt to connect
			this.socket.connect();
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
		this.socket.close();
		this._state = DirectoryConnectionState.DISCONNECTED;
		logger.info('Disconnected from Directory');
	}

	/** Handle successful connection to Directory */
	private onConnect(): void {
		if (this._state === DirectoryConnectionState.INITIAL_CONNECTION_PENDING) {
			logger.info('Connected to Directory');
		} else if (this._state === DirectoryConnectionState.CONNECTION_LOST) {
			logger.alert('Re-Connected to Directory');
		} else {
			logger.fatal('Assertion failed: received \'connect\' event when in state:', DirectoryConnectionState[this._state]);
			return;
		}
		this._state = DirectoryConnectionState.REGISTRATION_PENDING;
		this.register()
			.catch((err) => {
				// Ignore if the error comes after we no longer expect the registration to happen (e.g. DC during registration)
				if (this._state !== DirectoryConnectionState.REGISTRATION_PENDING)
					return;
				logger.fatal('Failed to register to Directory:', err);
			});
	}

	/** Handle loss of connection to Directory */
	private onDisconnect(reason: Socket.DisconnectReason) {
		// If the disconnect was requested, just ignore this
		if (this._state === DirectoryConnectionState.DISCONNECTED)
			return;
		if (this._state === DirectoryConnectionState.CONNECTED || this._state === DirectoryConnectionState.REGISTRATION_PENDING) {
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

	@AsyncSynchronized()
	private async updateFromDirectory({ spaces, characters, messages }: Partial<IDirectoryShardUpdate>): Promise<void> {
		// Invalidate old characters
		if (characters) {
			const characterIds = characters.map((c) => c.id);
			await Promise.allSettled(
				CharacterManager
					.listCharacters()
					.map((c) => c.id)
					.filter((id) => !characterIds.includes(id))
					.map((id) => CharacterManager.removeCharacter(id)),
			);
		}

		// Invalidate old spaces
		if (spaces) {
			const spaceIds = spaces.map((r) => r.id);
			await Promise.allSettled(
				SpaceManager
					.listSpaceIds()
					.filter((id) => !spaceIds.includes(id))
					.map((id) => SpaceManager.removeSpace(id)),
			);
		}

		// Load and update existing spaces
		if (spaces) {
			await Promise.all(
				spaces.map((space) =>
					SpaceManager
						.loadSpace(space)
						.then((result) => {
							if (!result) {
								logger.error(`Failed to load space ${space.id} for access ${space.accessId}`);
								// Report back that space load failed
								this.sendMessage('spaceError', { id: space.id });
							}
						})
						.catch((err) => {
							// Report back that space load failed
							this.sendMessage('spaceError', { id: space.id });
							// Log fatal error after the report, to allow us to recover if bad state is persistent
							logger.fatal('Error processing prepareCharacters message', err);
						}),
				),
			);
		}

		// Load and update existing characters
		if (characters) {
			await Promise.all(
				characters.map((character) =>
					CharacterManager
						.loadCharacter(character)
						.then((result) => {
							if (!result) {
								logger.error(`Failed to load character ${character.id} for access ${character.accessId}`);
								// Report back that character load failed
								this.sendMessage('characterError', { id: character.id });
							}
						})
						.catch((err) => {
							logger.error(`Failed to load character ${character.id} for access ${character.accessId}:\n`, err);
							// Report back that character load failed
							this.sendMessage('characterError', { id: character.id });
						}),
				),
			);
		}

		// Run a tick in all spaces so automatic cleanup can happen
		for (const space of SpaceManager.getAllSpaces()) {
			space.runAutomaticActions();
		}
		for (const character of CharacterManager.getValidCharacters()) {
			// Tick only personal spaces on characters (public ones were ticked above)
			const space = character.loadedSpace;
			if (space != null && space.id == null) {
				space.runAutomaticActions();
			}
		}

		if (messages) {
			for (const [spaceId, messageList] of Object.entries(messages)) {
				if (messageList == null)
					continue;
				const space = SpaceManager.getSpace(SpaceIdSchema.parse(spaceId));
				if (!space) {
					logger.warning('Ignoring messages to non-existing space', spaceId);
					continue;
				}
				space.processDirectoryMessages(messageList);
			}
		}
	}

	private async register(): Promise<void> {
		const features: ShardFeature[] = [];
		if (SHARD_DEVELOPMENT_MODE) {
			features.push('development');
		}

		const { shardId, ...update } = await this.awaitResponse('shardRegister', {
			publicURL: SERVER_PUBLIC_ADDRESS,
			features,
			version: APP_VERSION,
			databaseVersion: PANDORA_VERSION_DATABASE,
			characters: CharacterManager.listCharacters(),
			disconnectCharacters: CharacterManager.listInvalidCharacters(),
			spaces: SpaceManager.listSpaces(),
		}, 10_000);

		if (this._state !== DirectoryConnectionState.REGISTRATION_PENDING) {
			logger.warning('Ignoring finished registration when in state:', DirectoryConnectionState[this._state]);
			return;
		}

		this.shardId = shardId;
		await this.updateFromDirectory(update);

		this._state = DirectoryConnectionState.CONNECTED;
		logger.info('Registered with Directory');
	}

	private handleSpaceCheckCanLeave({ character: characterId }: IDirectoryShardArgument['spaceCheckCanLeave']): IDirectoryShardResult['spaceCheckCanLeave'] {
		const character = CharacterManager.getCharacter(characterId);

		// We must know the character and character must be in a space
		if (character == null)
			return { result: 'targetNotFound' };

		const restrictionManager = character.getRestrictionManager();
		const inPublicSpace = character.getCurrentPublicSpaceId() != null;

		if (restrictionManager.getRoomDeviceLink() != null)
			return { result: 'inRoomDevice' };

		// Skips any checks if force-allow is enabled
		if (!restrictionManager.forceAllowRoomLeave()) {
			// The character must not have leave-restricting effect (this doesn't affect personal spaces)
			if (restrictionManager.getEffects().blockSpaceLeave && inPublicSpace)
				return { result: 'restricted' };
		}

		return { result: 'ok' };
	}

	private handleSpaceSwitchPermissionCheck({ actor: actorId, target: targetId }: IDirectoryShardArgument['spaceSwitchPermissionCheck']): IDirectoryShardResult['spaceSwitchPermissionCheck'] {
		const actor = CharacterManager.getCharacter(actorId);
		const target = CharacterManager.getCharacter(targetId);

		// We must know the actor and character must be in the same space
		if (actor == null || target == null || target.getOrLoadSpace() !== actor.getOrLoadSpace())
			return { result: 'notFound' };

		const checkResult = target.checkSpaceSwitchStatus(actor);

		if (checkResult.permission == null)
			return { result: 'notFound' };

		return {
			result: 'ok',
			permission: checkResult.permission,
		};
	}
}

export let DirectoryConnector!: SocketIODirectoryConnector;

export function ConnectToDirectory(): Promise<SocketIODirectoryConnector> {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Missing DIRECTORY_ADDRESS');
	}
	if (DirectoryConnector) {
		throw new Error('Connector already exists');
	}
	// Create the connection
	DirectoryConnector = new SocketIODirectoryConnector(DIRECTORY_ADDRESS, SHARD_SHARED_SECRET);
	// Start
	return DirectoryConnector.connect();
}
