import { nanoid } from 'nanoid';
import { GetLogger, Logger, IChatRoomBaseInfo, IChatRoomDirectoryConfig, IChatRoomDirectoryInfo, IChatRoomFullInfo, RoomId, CharacterId, IChatRoomLeaveReason, AssertNever, IChatRoomMessageDirectoryAction } from 'pandora-common';
import { ChatActionId } from 'pandora-common/dist/chatroom/chatActions';
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
		this.id = id ?? `r${nanoid()}` as const;
		this.logger = GetLogger('Room', `[Room ${this.id}]`);
		this.config = config;

		// Make sure things that should are unique
		this.config.features = uniq(this.config.features);
		this.config.admin = uniq(this.config.admin);
		this.config.banned = uniq(this.config.banned);

		this.shard = shard;
		shard.rooms.add(this);
		this.logger.verbose('Created');
		shard.update('rooms');
	}

	/** Map of character ids to account id */
	private readonly characters: Set<Character> = new Set();

	public get characterCount(): number {
		return this.characters.size;
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

	public update(changes: Partial<IChatRoomDirectoryConfig>, source: Character | null): 'ok' | 'nameTaken' {
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
		if (changes.background) {
			this.config.background = changes.background;
		}

		// Features and development fields are intentionally ignored

		// Send message about room being updated
		if (source) {
			const changeList: string[] = [];
			if (changes.name)
				changeList.push(`name to '${changes.name}'`);
			if (changes.maxUsers !== undefined)
				changeList.push(`room size to '${changes.maxUsers}'`);
			if (changes.protected !== undefined)
				changeList.push(`access to '${this.config.protected ? (this.config.password ? 'protected with password' : 'protected') : 'public'}'`);
			if (changes.description !== undefined)
				changeList.push('description');
			if (changes.admin)
				changeList.push('admins');
			if (changes.banned)
				changeList.push('ban list');
			if (changes.background)
				changeList.push('background');

			if (changeList.length >= 2) {
				this.sendMessage({
					type: 'serverMessage',
					id: 'roomUpdatedMultiple',
					data: {
						character: source.id,
					},
					dictionary: {
						COUNT: `${changeList.length}`,
						CHANGES: changeList.map((l) => ` \u2022 ${l}`).join('\n'),
					},
				});
			} else if (changeList.length === 1) {
				this.sendMessage({
					type: 'serverMessage',
					id: 'roomUpdatedSingle',
					data: {
						character: source.id,
					},
					dictionary: {
						CHANGE: changeList[0],
					},
				});
			}
		}

		this.shard.update('rooms');
		ConnectionManagerClient.onRoomListChange();
		return 'ok';
	}

	public migrateTo(room: Room): Promise<void> {
		this.logger.info('Migrating to room', room.id);
		const promises: Promise<unknown>[] = [];
		for (const character of Array.from(this.characters.values())) {
			this.removeCharacter(character, 'destroy');
			promises.push(
				character
					.connectToShard({ room, sendEnterMessage: false })
					.then(() => {
						character.assignedConnection?.sendConnectionStateUpdate();
					}, (err) => {
						this.logger.fatal('Error reconnecting character to different room', err);
					}),
			);
		}
		return Promise.all(promises).then(() => undefined);
	}

	public onDestroy(): void {
		for (const character of Array.from(this.characters.values())) {
			this.removeCharacter(character, 'destroy');
		}
		this.shard.rooms.delete(this);
		this.logger.verbose('Destroyed');
		this.shard.update('rooms');
	}

	public checkAllowEnter(character: Character, password?: string): 'ok' | 'errFull' | 'noAccess' | 'invalidPassword' {
		if (character.room === this)
			return 'ok';

		if (this.characterCount >= this.config.maxUsers)
			return 'errFull';

		if (this.config.banned.includes(character.account.id))
			return 'noAccess';

		if (this.config.protected &&
			!this.config.admin.includes(character.account.id) &&
			(this.config.password === null || password !== this.config.password)
		) {
			return this.config.password !== null ? 'invalidPassword' : 'noAccess';
		}

		return 'ok';
	}

	public isAdmin(character: Character): boolean {
		if (this.config.admin.includes(character.account.id))
			return true;

		if (this.config.development?.autoAdmin && character.account.roles.isAuthorized('developer'))
			return true;

		return false;
	}

	public addCharacter(character: Character, sendEnterMessage: boolean = true): void {
		if (character.room === this)
			return;
		if (this.config.banned.includes(character.account.id)) {
			this.logger.warning(`Refusing to add banned character id ${character.id}`);
			return;
		}
		if (character.room !== null) {
			throw new Error('Attempt to add character that is in different room');
		}
		this.logger.debug(`Character ${character.id} entered`);
		this.characters.add(character);
		character.room = this;

		// Report the enter
		if (sendEnterMessage) {
			this.sendMessage({
				type: 'serverMessage',
				id: 'characterEntered',
				data: {
					character: character.id,
				},
			});
		}

		this.shard.update('characters');
		ConnectionManagerClient.onRoomListChange();
	}

	public removeCharacter(character: Character, reason: IChatRoomLeaveReason): void {
		if (character.room !== this)
			return;
		this.logger.debug(`Character ${character.id} removed (${reason})`);
		this.characters.delete(character);
		character.room = null;

		// Report the leave
		let action: ChatActionId | undefined;
		if (reason === 'leave') {
			action = 'characterLeft';
		} else if (reason === 'disconnect') {
			action = 'characterDisconnected';
		} else if (reason === 'kick') {
			action = 'characterKicked';
		} else if (reason === 'ban') {
			action = 'characterBanned';
		} else if (reason === 'destroy') {
			// Do not report room being destroyed, everyone is removed anyway
		} else {
			AssertNever(reason);
		}
		if (action) {
			this.sendMessage({
				type: 'serverMessage',
				id: action,
				data: {
					character: character.id,
				},
			});
		}

		// If the reason is ban, also actually ban the account and kick any other characters of that account
		if (reason === 'ban' && !this.config.banned.includes(character.account.id)) {
			this.config.banned.push(character.account.id);
			this.removeBannedCharacters();
		}

		this.cleanupIfEmpty();
		this.shard.update('characters');
		ConnectionManagerClient.onRoomListChange();
	}

	private removeBannedCharacters(): void {
		for (const character of this.characters.values()) {
			if (this.config.banned.includes(character.account.id)) {
				this.removeCharacter(character, 'ban');
			}
		}
	}

	public cleanupIfEmpty() {
		if (this.characters.size === 0) {
			ShardManager.destroyRoom(this);
		}
	}

	public readonly pendingMessages: IChatRoomMessageDirectoryAction[] = [];
	private lastMessageTime: number = 0;

	private nextMessageTime(): number {
		let time = Date.now();
		// Make sure the time is unique
		if (time <= this.lastMessageTime) {
			time = this.lastMessageTime + 1;
		}
		return this.lastMessageTime = time;
	}

	public sendMessage(...messages: Omit<IChatRoomMessageDirectoryAction, 'directoryTime'>[]): void {
		const processedMessages = messages.map<IChatRoomMessageDirectoryAction>(
			(msg) => ({
				directoryTime: this.nextMessageTime(),
				...msg,
			}),
		);
		this.pendingMessages.push(...processedMessages);
		this.shard.update('messages');
	}
}
