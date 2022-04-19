import { nanoid } from 'nanoid';
import { GetLogger, Logger, IChatRoomBaseInfo, IChatRoomDirectoryConfig, IChatRoomDirectoryInfo, IChatRoomFullInfo, RoomId, CharacterId, IChatRoomLeaveReason } from 'pandora-common';
import { Character } from '../account/character';
import { Shard } from './shard';
import { ShardManager } from './shardManager';
import { ConnectionManagerClient } from '../networking/manager_client';
import { uniq } from 'lodash';

export class Room {
	public readonly id: RoomId;
	public readonly shard: Shard;

	private config: IChatRoomDirectoryConfig;

	public get name(): string {
		return this.config.name;
	}

	private logger: Logger;

	constructor(config: IChatRoomDirectoryConfig, shard: Shard, id?: RoomId) {
		this.id = id ?? `r${nanoid()}`;
		this.logger = GetLogger('Room', `[Room ${this.id}]`);
		this.config = config;

		// Make sure things that should are unique
		this.config.features = uniq(this.config.features);
		this.config.admin = uniq(this.config.admin);
		this.config.banned = uniq(this.config.banned);

		this.shard = shard;
		shard.rooms.add(this);
		this.logger.info('Created');
		shard.updateCharacterList();
	}

	/** Map of character ids to account id */
	private readonly characters: Set<Character> = new Set();

	public get characterCount(): number {
		return this.characters.size;
	}

	private readonly leaveReasons: Map<CharacterId, IChatRoomLeaveReason> = new Map();
	public getAndClearLeaveReasons(): Record<CharacterId, undefined | IChatRoomLeaveReason> | undefined {
		if (this.leaveReasons.size === 0) {
			return undefined;
		}
		const result: Record<CharacterId, undefined | IChatRoomLeaveReason> = {};
		for (const [k, v] of this.leaveReasons.entries()) {
			result[k] = v;
		}
		this.leaveReasons.clear();
		return result;
	}

	public getJoinedCharacter(id: CharacterId): Character | null {
		for (const character of this.characters) {
			if (character.id === id)
				return character;
		}
		return null;
	}

	public getBaseInfo(): IChatRoomBaseInfo {
		return ({
			name: this.config.name,
			description: this.config.description,
			protected: this.config.protected,
			maxUsers: this.config.maxUsers,
		});
	}

	public getDirectoryInfo(): IChatRoomDirectoryInfo {
		return ({
			...this.getBaseInfo(),
			id: this.id,
			hasPassword: this.config.password !== null,
			users: this.characterCount,
		});
	}

	public getFullInfo(): IChatRoomFullInfo {
		return ({
			...this.config,
			id: this.id,
		});
	}

	public update(changes: Partial<IChatRoomDirectoryConfig>): 'ok' | 'nameTaken' {
		if (changes.name) {
			const otherRoom = ShardManager.getRoomByName(changes.name);
			if (otherRoom && otherRoom !== this)
				return 'nameTaken';
			this.config.name = changes.name;
		}
		if (changes.description !== undefined) {
			this.config.description = changes.description;
		}
		if (changes.maxUsers !== undefined) {
			this.config.maxUsers = changes.maxUsers;
		}
		if (changes.admin) {
			this.config.admin = uniq(changes.admin);
		}
		if (changes.banned) {
			this.config.banned = uniq(changes.banned);
			this.removeBannedCharacters();
		}
		if (changes.protected !== undefined) {
			if (changes.protected) {
				this.config.protected = true;
				if (changes.password !== undefined) {
					this.config.password = changes.password;
				}
			} else {
				this.config.protected = false;
				this.config.password = null;
			}
		}

		// Features and development fields are intentionally ignored

		this.shard.updateCharacterList();
		ConnectionManagerClient.onRoomListChange();
		return 'ok';
	}

	public onDestroy(): void {
		for (const character of Array.from(this.characters.values())) {
			this.removeCharacter(character, 'destroy');
		}
		this.shard.rooms.delete(this);
		this.logger.info('Destroyed');
		this.shard.updateCharacterList();
	}

	public checkAllowEnter(character: Character, password?: string): 'ok' | 'errFull' | 'noAccess' | 'invalidPassword' {
		if (character.room === this)
			return 'ok';

		if (this.characterCount >= this.config.maxUsers)
			return 'errFull';

		if (this.config.banned.includes(character.account.data.id))
			return 'noAccess';

		if (this.config.protected &&
			!this.config.admin.includes(character.account.data.id) &&
			(this.config.password === null || password !== this.config.password)
		) {
			return this.config.password !== null ? 'invalidPassword' : 'noAccess';
		}

		return 'ok';
	}

	public isAdmin(character: Character): boolean {
		return this.config.admin.includes(character.account.data.id);
	}

	public addCharacter(character: Character): void {
		if (character.room === this)
			return;
		if (this.config.banned.includes(character.account.data.id)) {
			this.logger.warning(`Refusing to add banned character id ${character.id}`);
			return;
		}
		if (character.room !== null) {
			throw new Error('Attempt to add character that is in different room');
		}
		this.logger.verbose(`Character ${character.id} entered`);
		this.characters.add(character);
		character.room = this;
		this.shard.updateCharacterList();
		ConnectionManagerClient.onRoomListChange();
	}

	public removeCharacter(character: Character, reason: IChatRoomLeaveReason): void {
		if (character.room !== this)
			return;
		this.logger.verbose(`Character ${character.id} removed (${reason})`);
		this.leaveReasons.set(character.id, reason);
		this.characters.delete(character);
		character.room = null;

		// If the reason is ban, also actually ban the account and kick any other characters of that account
		if (reason === 'ban' && !this.config.banned.includes(character.account.data.id)) {
			this.config.banned.push(character.account.data.id);
			this.removeBannedCharacters();
		}

		this.cleanupIfEmpty();
		this.shard.updateCharacterList();
		ConnectionManagerClient.onRoomListChange();
	}

	private removeBannedCharacters(): void {
		for (const character of this.characters.values()) {
			if (this.config.banned.includes(character.account.data.id)) {
				this.removeCharacter(character, 'ban');
			}
		}
	}

	public cleanupIfEmpty() {
		if (this.characters.size === 0) {
			ShardManager.destroyRoom(this);
		}
	}
}
