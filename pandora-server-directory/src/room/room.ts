import { GetLogger, Logger, IChatRoomBaseInfo, IChatRoomDirectoryConfig, IChatRoomDirectoryInfo, IChatRoomFullInfo, RoomId, IChatRoomLeaveReason, AssertNever, IChatRoomMessageDirectoryAction, IChatRoomDirectoryExtendedInfo, IClientDirectoryArgument, AssertNotNullable, Assert, AccountId } from 'pandora-common';
import { ChatActionId } from 'pandora-common/dist/chatroom/chatActions';
import { Character } from '../account/character';
import { Shard } from '../shard/shard';
import { ConnectionManagerClient } from '../networking/manager_client';
import { pick, uniq } from 'lodash';
import { ShardManager } from '../shard/shardManager';
import { GetDatabase } from '../database/databaseProvider';

export class Room {
	public readonly id: RoomId;
	private readonly config: IChatRoomDirectoryConfig;
	private readonly _owners: Set<AccountId>;

	public assignedShard: Shard | null = null;
	public accessId: string = '';

	public get name(): string {
		return this.config.name;
	}

	public get owners(): ReadonlySet<AccountId> {
		return this._owners;
	}

	private readonly logger: Logger;

	constructor(id: RoomId, config: IChatRoomDirectoryConfig, owners: AccountId[]) {
		this.id = id;
		this.config = config;
		this._owners = new Set(owners);
		this.logger = GetLogger('Room', `[Room ${this.id}]`);

		// Make sure things that should are unique
		this.config.features = uniq(this.config.features);
		this.config.admin = uniq(this.config.admin);
		this.config.banned = uniq(this.config.banned);

		this.logger.verbose('Created');
	}

	public isInUse(): this is { assignedShard: Shard; } {
		return this.assignedShard != null;
	}

	/** Map of character ids to account id */
	private readonly _characters: Set<Character> = new Set();

	public get characters(): ReadonlySet<Character> {
		return this._characters;
	}

	public get characterCount(): number {
		return this._characters.size;
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

	public getDirectoryExtendedInfo(): IChatRoomDirectoryExtendedInfo {
		return ({
			...this.getDirectoryInfo(),
			...pick(this.config, ['features', 'admin', 'background']),
			owners: Array.from(this._owners),
			characters: Array.from(this._characters).map((c) => ({
				id: c.id,
				accountId: c.account.id,
				name: c.data.name,
			})),
		});
	}

	public getConfig(): IChatRoomDirectoryConfig {
		return this.config;
	}

	public getFullInfo(): IChatRoomFullInfo {
		return ({
			...this.config,
			id: this.id,
			owners: Array.from(this._owners),
		});
	}

	public async update(changes: Partial<IChatRoomDirectoryConfig>, source: Character | null): Promise<'ok'> {
		if (changes.name) {
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
			this.removeBannedCharacters(source);
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

			this.sendUpdatedMessage(source, ...changeList);
		}

		this.assignedShard?.update('rooms');

		await GetDatabase().updateChatRoom({ id: this.id, config: this.config }, null);

		ConnectionManagerClient.onRoomListChange();
		return 'ok';
	}

	private sendUpdatedMessage(source: Character, ...changeList: string[]) {
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

	public adminAction(source: Character, action: IClientDirectoryArgument['chatRoomAdminAction']['action'], targets: number[]) {
		targets = uniq(targets);
		let updated = false;
		switch (action) {
			case 'kick':
				for (const character of this.characters) {
					if (!targets.includes(character.account.id))
						continue;

					updated = true;
					this.removeCharacter(character, 'kick', source);
				}
				break;
			case 'ban': {
				const oldSize = this.config.banned.length;
				this.config.banned = uniq([...this.config.banned, ...targets]);
				updated = oldSize !== this.config.banned.length;
				if (updated) {
					this.removeBannedCharacters(source);
					this.sendUpdatedMessage(source, 'ban list');
				}
				break;
			}
			case 'unban': {
				const oldSize = this.config.banned.length;
				this.config.banned = this.config.banned.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.banned.length;
				if (updated)
					this.sendUpdatedMessage(source, 'ban list');

				break;
			}
			case 'promote': {
				const oldSize = this.config.admin.length;
				this.config.admin = uniq([...this.config.admin, ...targets]);
				updated = oldSize !== this.config.admin.length;
				if (updated)
					this.sendUpdatedMessage(source, 'admins');

				break;
			}
			case 'demote': {
				const oldSize = this.config.admin.length;
				this.config.admin = this.config.admin.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.admin.length;
				if (updated)
					this.sendUpdatedMessage(source, 'admins');

				break;
			}
			default:
				AssertNever(action);
		}
		if (updated) {
			this.assignedShard?.update('rooms');
			ConnectionManagerClient.onRoomListChange();
		}
	}

	public onDestroy(): void {
		for (const character of Array.from(this._characters.values())) {
			this.removeCharacter(character, 'destroy', null);
		}
		this.disconnect();
		Assert(this.assignedShard == null);
		Assert(this._characters.size === 0);
		this.logger.verbose('Destroyed');
	}

	public checkAllowEnter(character: Character, password?: string): 'ok' | 'errFull' | 'noAccess' | 'invalidPassword' {
		if (character.room === this)
			return 'ok';

		if (this.config.banned.includes(character.account.id))
			return 'noAccess';

		if (this.config.protected &&
			!this.isAdmin(character) &&
			(this.config.password === null || password !== this.config.password)
		) {
			return this.config.password !== null ? 'invalidPassword' : 'noAccess';
		}

		if (this.characterCount >= this.config.maxUsers)
			return 'errFull';

		return 'ok';
	}

	public isAdmin(character: Character): boolean {
		if (this._owners.has(character.account.id))
			return true;

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
		this._characters.add(character);
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

		this.assignedShard?.update('characters');
		ConnectionManagerClient.onRoomListChange();
	}

	public removeCharacter(character: Character, reason: IChatRoomLeaveReason, source: Character | null): void {
		if (character.room !== this)
			return;
		this.logger.debug(`Character ${character.id} removed (${reason})`);
		this._characters.delete(character);
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
					targetCharacter: character.id,
					character: source?.id ?? character.id,
				},
			});
		}

		// If the reason is ban, also actually ban the account and kick any other characters of that account
		if (reason === 'ban' && !this.config.banned.includes(character.account.id)) {
			this.config.banned.push(character.account.id);
			this.removeBannedCharacters(source);
		}

		this.assignedShard?.update('characters');
		this.cleanupIfEmpty();
		ConnectionManagerClient.onRoomListChange();
	}

	private removeBannedCharacters(source: Character | null): void {
		for (const character of this._characters.values()) {
			if (this.config.banned.includes(character.account.id)) {
				this.removeCharacter(character, 'ban', source);
			}
		}
	}

	public disconnect(): void {
		this.assignedShard?.disconnectRoom(this);
	}

	public async generateAccessId(): Promise<string | null> {
		const result = await GetDatabase().setChatRoomAccess(this.id);
		if (result != null) {
			this.accessId = result;
		}
		return result;
	}

	public async connect(): Promise<'noShardFound' | 'failed' | Shard> {
		let shard: Shard | null = this.assignedShard;
		if (!shard) {
			if (this.config.features.includes('development') && this.config.development?.shardId) {
				shard = ShardManager.getShard(this.config.development.shardId);
			} else {
				shard = ShardManager.getRandomShard();
			}
		}
		// If there is still no shard found, then we disconnect
		if (!shard) {
			this.disconnect();
			return 'noShardFound';
		}
		return await this._connectToShard(shard);
	}

	protected async _connectToShard(shard: Shard): Promise<'failed' | Shard> {
		// If we are on a wrong shard, we leave it
		if (this.assignedShard !== shard) {
			this.assignedShard?.disconnectRoom(this);

			// Generate new access id for new shard
			const accessId = await this.generateAccessId();
			if (accessId == null)
				return 'failed';
		}

		// Check that we can actually join the shard (prevent race condition on shard shutdown)
		if (!shard.allowConnect()) {
			return 'failed';
		}

		if (this.assignedShard !== shard) {
			shard.connectRoom(this);
		}

		AssertNotNullable(this.assignedShard);
		return this.assignedShard;
	}

	public cleanupIfEmpty() {
		if (this._characters.size === 0) {
			this.disconnect();
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
		this.assignedShard?.update('messages');
	}
}
