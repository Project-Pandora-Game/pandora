import { AssertNever, CharacterId, GetLogger, ICharacterData, ICharacterDataUpdate, IShardCharacterDefinition, Logger, RoomId } from 'pandora-common';
import { DirectoryConnector } from '../networking/socketio_directory_connector';
import { CHARACTER_TIMEOUT } from './characterManager';
import { SocketIOConnectionClient } from '../networking/socketio_client_connection';
import type { Room } from '../room/room';
import { RoomManager } from '../room/roomManager';
import { GetDatabase } from '../database/databaseProvider';

export const enum CharacterModification {
	NONE = 0,
	MODIFIED = 1,
	PENDING = 2,
}

type ICharacterDataChange = Omit<ICharacterDataUpdate, 'id'>;

export class Character {
	public readonly data: ICharacterData;
	public connectSecret: string;

	private state = CharacterModification.NONE;
	private modified: Set<keyof ICharacterDataChange> = new Set();

	public connection: SocketIOConnectionClient | null = null;
	private invalid: null | 'timeout' | 'error' | 'remove' = null;
	private timeout: NodeJS.Timeout | null = null;

	public room: Room | null = null;

	public get id(): CharacterId {
		return this.data.id;
	}

	public get isValid(): boolean {
		return this.invalid === null;
	}

	private logger: Logger;

	constructor(data: ICharacterData, connectSecret: string, room: RoomId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.connectSecret = connectSecret;
		this.setConnection(null);
		this.linkRoom(room);
	}

	public update(data: IShardCharacterDefinition) {
		if (data.id !== this.data.id) {
			throw new Error('Character update changes id');
		}
		if (data.account !== this.data.accountId) {
			throw new Error('Character update changes account');
		}
		if (data.accessId !== this.data.accessId) {
			this.logger.warning('Access id changed! This could be a bug');
			this.data.accessId = data.accessId;
		}
		if (data.connectSecret !== this.connectSecret) {
			this.logger.debug('Connection secret changed');
			this.connectSecret = data.connectSecret;
			if (this.connection) {
				this.connection.abortConnection();
			}
		}
		this.linkRoom(data.room);
	}

	private linkRoom(id: RoomId | null): void {
		let room: Room | null = null;
		if (id != null) {
			room = RoomManager.getRoom(id) ?? null;
			if (!room) {
				this.logger.error(`Failed to link character to room ${id}; not found`);
			}
		}
		if (this.room !== room) {
			this.room?.characterLeave(this, RoomManager.leaveReasons[this.room.id]?.[this.id] ?? 'disconnect');
			room?.characterEnter(this);
		}
	}

	public isInUse(): boolean {
		return this.connection !== undefined;
	}

	public setConnection(connection: SocketIOConnectionClient | null): void {
		if (this.invalid) {
			AssertNever();
		}
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		const oldConnection = this.connection;
		this.connection = null;
		if (oldConnection && oldConnection !== connection) {
			this.logger.debug(`Disconnected (${oldConnection.id})`);
			oldConnection.character = null;
			oldConnection.abortConnection();
		}
		if (connection) {
			this.logger.debug(`Connected (${connection.id})`);
			connection.character = this;
			this.connection = connection;
		} else if (this.isValid) {
			this.timeout = setTimeout(this.handleTimeout.bind(this), CHARACTER_TIMEOUT);
		}
	}

	private handleTimeout(): void {
		if (this.invalid) {
			AssertNever();
		}
		this.logger.verbose('Timed out');
		this.invalidate('timeout');
	}

	public async finishCreation(name: string): Promise<boolean> {
		if (!this.data.inCreation)
			return false;

		this.setValue('name', name);
		await this.save();

		if (!this.modified.has('name')) {
			const { created } = await DirectoryConnector.awaitResponse('createCharacter', { id: this.data.id });
			this.data.created = created;
			this.data.inCreation = undefined;
			this.connection?.sendMessage('updateCharacter', {
				created,
			});
			return true;
		}

		return false;
	}

	public onRemove(): void {
		this.room?.characterLeave(this, RoomManager.leaveReasons[this.room.id]?.[this.id] ?? 'disconnect');
		this.state = CharacterModification.NONE;
		this.modified.clear();
		this.invalidate('remove');
	}

	private invalidate(reason: 'timeout' | 'error' | 'remove'): void {
		if (this.invalid !== null)
			return;
		this.invalid = reason;
		const oldConnection = this.connection;
		this.connection = null;
		if (oldConnection) {
			this.logger.debug(`Disconnected during invalidation (${oldConnection.id})`);
			oldConnection.character = null;
			oldConnection.abortConnection();
		}
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (reason !== 'remove') {
			DirectoryConnector.sendMessage('characterDisconnect', { id: this.id, reason });
		}
	}

	public static async load(id: CharacterId, accessId: string): Promise<ICharacterData | null> {
		const character = await GetDatabase().getCharacter(id, accessId);
		if (character === false) {
			return null;
		}
		return character;
	}

	public async save(): Promise<void> {
		if (this.state !== CharacterModification.MODIFIED)
			return;

		this.state = CharacterModification.PENDING;
		const keys: (keyof Omit<ICharacterDataUpdate, 'id'>)[] = [...this.modified];
		this.modified.clear();

		const data: ICharacterDataUpdate = {
			id: this.data.id,
			accessId: this.data.accessId,
		};

		for (const key of keys) {
			(data as Record<string, unknown>)[key] = this.data[key];
		}

		if (await GetDatabase().setCharacter(data)) {
			if (this.state === CharacterModification.PENDING)
				this.state = CharacterModification.NONE;
		} else {
			for (const key of keys) {
				this.modified.add(key);
			}
			this.state = CharacterModification.MODIFIED;
		}
	}

	private setValue<Key extends keyof ICharacterDataChange>(key: Key, value: ICharacterData[Key]): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);
		this.state = CharacterModification.MODIFIED;

		this.connection?.sendMessage('updateCharacter', { [key]: value });
	}
}
