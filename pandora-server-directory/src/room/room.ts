import { GetLogger, Logger, IChatRoomBaseInfo, IChatRoomDirectoryConfig, IChatRoomListInfo, IChatRoomFullInfo, RoomId, IChatRoomLeaveReason, AssertNever, IChatRoomMessageDirectoryAction, IChatRoomListExtendedInfo, IClientDirectoryArgument, AssertNotNullable, Assert, AccountId } from 'pandora-common';
import { ChatActionId } from 'pandora-common/dist/chatroom/chatActions';
import { Character } from '../account/character';
import { Shard } from '../shard/shard';
import { ConnectionManagerClient } from '../networking/manager_client';
import { pick, uniq } from 'lodash';
import { ShardManager } from '../shard/shardManager';
import { GetDatabase } from '../database/databaseProvider';
import { RoomManager } from '../room/roomManager';
import { Account } from '../account/account';

export class Room {
	/** Time when this room was last requested */
	public lastActivity: number = Date.now();

	public readonly id: RoomId;
	private readonly config: IChatRoomDirectoryConfig;
	private readonly _owners: Set<AccountId>;

	private _assignedShard: Shard | null = null;
	public get assignedShard(): Shard | null {
		return this._assignedShard;
	}

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

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	public isInUse(): boolean {
		return this._assignedShard != null;
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
			public: this.config.public,
			maxUsers: this.config.maxUsers,
		});
	}

	public getRoomListInfo(queryingAccount: Account): IChatRoomListInfo {
		return ({
			...this.getBaseInfo(),
			id: this.id,
			hasPassword: this.config.password !== null,
			users: this.characterCount,
			isOwner: this.isOwner(queryingAccount),
		});
	}

	public getRoomListExtendedInfo(queryingAccount: Account): IChatRoomListExtendedInfo {
		return ({
			...this.getRoomListInfo(queryingAccount),
			...pick(this.config, ['features', 'admin', 'background']),
			owners: Array.from(this._owners),
			isAdmin: this.isAdmin(queryingAccount),
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

	public async removeOwner(accountId: AccountId): Promise<'ok'> {
		// Owners get demoted to admins
		this._owners.delete(accountId);
		if (!this.config.admin.includes(accountId)) {
			this.config.admin.push(accountId);
		}

		if (this._owners.size === 0) {
			// Room without owners gets destroyed
			await RoomManager.destroyRoom(this);
		} else {
			// Room with remaining owners only propagates the change to shard and clients
			await this._assignedShard?.update('rooms');
			// TODO: Make an announcement of the change

			await GetDatabase().updateChatRoom(this.id, { owners: Array.from(this._owners) }, null);

			ConnectionManagerClient.onRoomListChange();
		}
		return 'ok';
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
			await this.removeBannedCharacters(source);
		}
		if (changes.public !== undefined) {
			this.config.public = changes.public;
		}
		if (changes.password !== undefined) {
			this.config.password = changes.password;
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
			if (changes.public !== undefined)
				changeList.push(`visibility to '${this.config.public ? 'public' : 'private'}'`);
			if (changes.password !== undefined)
				changeList.push('password');
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

		await Promise.all([
			this._assignedShard?.update('rooms'),
			GetDatabase().updateChatRoom(this.id, { config: this.config }, null),
		]);

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

	public async adminAction(source: Character, action: IClientDirectoryArgument['chatRoomAdminAction']['action'], targets: number[]): Promise<void> {
		targets = uniq(targets);
		let updated = false;
		switch (action) {
			case 'kick':
				for (const character of this.characters) {
					if (!targets.includes(character.account.id))
						continue;

					updated = true;
					await this.removeCharacter(character, 'kick', source);
				}
				break;
			case 'ban': {
				const oldSize = this.config.banned.length;
				this.config.banned = uniq([...this.config.banned, ...targets]);
				updated = oldSize !== this.config.banned.length;
				if (updated) {
					await this.removeBannedCharacters(source);
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
			ConnectionManagerClient.onRoomListChange();
			await this._assignedShard?.update('rooms');
		}
	}

	public async onDestroy(): Promise<void> {
		for (const character of Array.from(this._characters.values())) {
			await this.removeCharacter(character, 'destroy', null);
		}
		await this.disconnect();
		Assert(this._assignedShard == null);
		Assert(this._characters.size === 0);
		this.logger.verbose('Destroyed');
	}

	public checkAllowEnter(character: Character, password: string | null, ignoreCharacterLimit: boolean = false): 'ok' | 'errFull' | 'noAccess' | 'invalidPassword' {
		// If you are already in room, then you have rights to enter it
		if (character.room === this)
			return 'ok';

		// If the room is full, you cannot enter the room (some checks ignore room being full)
		if (this.characterCount >= this.config.maxUsers && !ignoreCharacterLimit)
			return 'errFull';

		// If you are an owner or admin, you can enter the room (owner implies admin)
		if (this.isAdmin(character.account))
			return 'ok';

		// If you are banned, you cannot enter the room
		if (this.config.banned.includes(character.account.id))
			return 'noAccess';

		// If the room is password protected and you have given valid password, you can enter the room
		if (this.config.password !== null && password && password === this.config.password)
			return 'ok';

		// If the room is public, you can enter the room (unless it is password protected)
		if (this.config.public && this.config.password === null)
			return 'ok';

		// Otherwise you cannot enter the room
		return (this.config.password !== null && password) ? 'invalidPassword' : 'noAccess';
	}

	/** Returns if this room is visible to the specific account when searching in room search */
	public checkVisibleTo(account: Account): boolean {
		return (
			this.isAdmin(account) ||
			(this.config.public && this.hasAdminInside() && this._assignedShard?.type === 'stable')
		);
	}

	public isOwner(account: Account): boolean {
		return this._owners.has(account.id);
	}

	public isAdmin(account: Account): boolean {
		if (this.isOwner(account))
			return true;

		if (this.config.admin.includes(account.id))
			return true;

		if (this.config.development?.autoAdmin && account.roles.isAuthorized('developer'))
			return true;

		return false;
	}

	public isBanned(account: Account): boolean {
		if (this.isAdmin(account))
			return false;

		if (this.config.banned.includes(account.id))
			return true;

		return false;
	}

	public hasAdminInside(): boolean {
		for (const c of this.characters) {
			if (this.isAdmin(c.account)) {
				return true;
			}
		}
		return false;
	}

	public async addCharacter(character: Character, sendEnterMessage: boolean = true): Promise<void> {
		Assert(character.shardSelector?.type === 'room' && character.shardSelector.room === this);
		if (character.room === this)
			return;
		Assert(character.room == null);

		if (this.isBanned(character.account)) {
			this.logger.warning(`Refusing to add banned character id ${character.id}`);
			return;
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

		ConnectionManagerClient.onRoomListChange();
		await this._assignedShard?.update('characters');
	}

	public async removeCharacter(character: Character, reason: IChatRoomLeaveReason, source: Character | null): Promise<void> {
		Assert(character.room === this);
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
			await this.removeBannedCharacters(source);
		}

		await this._assignedShard?.update('characters');
		await this.cleanupIfEmpty();
		ConnectionManagerClient.onRoomListChange();
	}

	private async removeBannedCharacters(source: Character | null): Promise<void> {
		for (const character of this._characters.values()) {
			if (this.isBanned(character.account)) {
				await this.removeCharacter(character, 'ban', source);
			}
		}
	}

	public async disconnect(): Promise<void> {
		await this.setShard(null);
		// Clear pending action messages when the room gets disconnected (this is not triggered on simple reassignment)
		this.pendingMessages.length = 0;
	}

	public async generateAccessId(): Promise<string | null> {
		const result = await GetDatabase().setChatRoomAccess(this.id);
		if (result != null) {
			this.accessId = result;
		}
		return result;
	}

	public async connect(): Promise<'noShardFound' | 'failed' | Shard> {
		let shard: Shard | null = this._assignedShard;
		if (!shard) {
			if (this.config.features.includes('development') && this.config.development?.shardId) {
				shard = ShardManager.getShard(this.config.development.shardId);
			} else {
				shard = ShardManager.getRandomShard();
			}
		}
		// If there is still no shard found, then we disconnect
		if (!shard) {
			await this.disconnect();
			return 'noShardFound';
		}
		return await this._connectToShard(shard);
	}

	public async shardReconnect(shard: Shard, accessId: string): Promise<void> {
		if (this.isInUse() || (this.accessId && this.accessId !== accessId))
			return;

		this.accessId = accessId;
		await this.setShard(shard);
	}

	private async _connectToShard(shard: Shard): Promise<'failed' | Shard> {
		this.touch();

		// If we are on a wrong shard, we leave it
		if (this._assignedShard !== shard) {
			await this.setShard(null);

			// Generate new access id for new shard
			const accessId = await this.generateAccessId();
			if (accessId == null)
				return 'failed';
		}

		// Check that we can actually join the shard (prevent race condition on shard shutdown)
		if (!shard.allowConnect()) {
			return 'failed';
		}

		if (this._assignedShard !== shard) {
			await this.setShard(shard);
		}

		AssertNotNullable(this._assignedShard);
		return this._assignedShard;
	}

	private async setShard(shard: Shard | null): Promise<void> {
		if (this._assignedShard === shard)
			return;
		if (this._assignedShard) {
			Assert(this._assignedShard.rooms.get(this.id) === this);

			// Disconnect all characters that are in this room, too
			for (const character of this.characters.values()) {
				await character.setShard(null);
			}

			this._assignedShard.rooms.delete(this.id);
			await this._assignedShard.update('rooms');

			this._assignedShard = null;

			this.logger.debug('Disconnected from shard');
		}
		if (shard) {
			Assert(this._assignedShard === null);
			Assert(shard.allowConnect(), 'Connecting to shard that doesn\'t allow connections');

			this._assignedShard = shard;

			shard.rooms.set(this.id, this);
			await shard.update('rooms');

			// Reconnect all characters that are in this room, too
			for (const character of this.characters.values()) {
				await character.setShard(shard);
			}

			this.logger.debug('Connected to shard', shard.id);
		}
		ConnectionManagerClient.onRoomListChange();
	}

	public async cleanupIfEmpty(): Promise<void> {
		if (this._characters.size === 0) {
			await this.disconnect();
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
		this._assignedShard?.update('messages').catch(() => { /* NOOP */ });
	}
}
