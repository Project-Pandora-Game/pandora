import { Assert, AssertNever, AsyncSynchronized, CharacterId, CloneDeepMutable, GetLogger, ICharacterData, ICharacterSelfInfo, ICharacterSelfInfoUpdate, IDirectoryCharacterConnectionInfo, Logger, NOT_NARROWING_TRUE, RoomId } from 'pandora-common';
import type { Account } from './account';
import type { Shard } from '../shard/shard';
import type { Room } from '../room/room';
import type { ClientConnection } from '../networking/connection_client';
import { GetDatabase, ICharacterSelfInfoDb } from '../database/databaseProvider';
import { nanoid } from 'nanoid';
import { ShardManager } from '../shard/shardManager';
import { RoomManager } from '../room/roomManager';
import { ConnectionManagerClient } from '../networking/manager_client';

function GenerateConnectSecret(): string {
	return nanoid(8);
}

export class CharacterInfo {
	public readonly id: CharacterId;
	public readonly account: Account;
	protected readonly logger: Logger;

	protected _data: Readonly<ICharacterSelfInfoDb>;
	public get data(): Readonly<ICharacterSelfInfoDb> {
		return this._data;
	}

	private _loadedCharacter: Character | null = null;
	public get loadedCharacter(): Character | null {
		return this._loadedCharacter;
	}

	constructor(characterData: ICharacterSelfInfoDb, account: Account) {
		this.logger = GetLogger('Character', `[Character ${characterData.id}]`);
		this.id = characterData.id;
		this.account = account;
		this._data = characterData;
	}

	public isInUse(): boolean {
		return this._loadedCharacter != null && this._loadedCharacter.isInUse();
	}

	public isOnline(): boolean {
		return this._loadedCharacter != null && this._loadedCharacter.isOnline();
	}

	public get inCreation(): boolean {
		return !!this.data.inCreation;
	}

	public onAccountInfoChange(): void {
		this._loadedCharacter?.currentShard?.update('characters').catch(() => { /* NOOP */ });
	}

	public getInfoState(): string {
		if (this.isOnline())
			return 'connected';

		if (this.inCreation)
			return 'inCreation';

		return '';
	}

	@AsyncSynchronized('object')
	public async finishCharacterCreation(): Promise<ICharacterData | null> {
		if (!this.inCreation)
			return null;

		const char = await GetDatabase().finalizeCharacter(this.account.id, this.id);
		if (!char)
			return null;

		const newData = CloneDeepMutable(this._data);
		newData.name = char.name;
		delete newData.inCreation;
		this._data = newData;

		this.account.onCharacterListChange();

		return char;
	}

	@AsyncSynchronized('object')
	public async updateSelfData(update: Omit<ICharacterSelfInfoUpdate, 'id'>): Promise<ICharacterSelfInfo | null> {
		const info = await GetDatabase().updateCharacter(this.account.id, {
			...update,
			id: this.id,
		});
		if (!info)
			return null;

		this._data = {
			...this._data,
			...update,
		};

		return ({
			...info,
			state: this.getInfoState(),
		});
	}

	@AsyncSynchronized()
	public async requestLoad(): Promise<Character> {
		if (this._loadedCharacter != null && NOT_NARROWING_TRUE)
			return this._loadedCharacter;

		const currentRoomId: RoomId | null = this._data.currentRoom ?? null;
		if (currentRoomId != null) {
			// If we want to load into a room, load it
			const room = await RoomManager.loadRoom(currentRoomId);
			if (room != null) {
				// If there is a room, check we were loaded into it
				Assert(this._loadedCharacter != null);
				return this._loadedCharacter;
			}
			// If the room failed to load, kick the character out of room
			this.logger.warning('Failed to load current room, force-kick');
			await this.updateSelfData({ currentRoom: null });
			// Fallthrough to behaviour outside of a room
		}

		// Load the character without a specified room
		this.load(null);
		Assert(this._loadedCharacter != null);
		return this._loadedCharacter;
	}

	public load(room: Room | null): void {
		Assert(this._loadedCharacter == null);
		this._loadedCharacter = new Character(this, room);
	}

	public trackedRoomUnload(room: Room): void {
		const oldCharacter = this._loadedCharacter;
		// Can only be perfromed when loaded and tracking specified room
		Assert(oldCharacter != null);
		Assert(oldCharacter.assignment?.type === 'room-joined' || oldCharacter.assignment?.type === 'room-tracking');
		Assert(oldCharacter.assignment.room === room);
		// The room shouldn't unload when any character is requesting it to be loaded or is loaded on a shard
		Assert(oldCharacter.connectSecret == null);
		Assert(oldCharacter.assignedClient == null);
		Assert(oldCharacter.currentShard == null);

		// Cleanup links to the room to allow it to properly unload
		room.trackingCharacters.delete(oldCharacter);
		oldCharacter.assignment = null;

		// Finish unload
		this._loadedCharacter = null;
	}

	@AsyncSynchronized('object')
	public shardReconnect({ shard, accessId, connectionSecret, room }: {
		shard: Shard;
		accessId: string;
		connectionSecret: string | null;
		room: Room | null;
	}): Promise<void> {
		// If we are in a room, the character should have already been loaded by the room
		if (room != null) {
			Assert(this._loadedCharacter != null);
		} else {
			// Someone else might have loaded the character meanwhile
			if (this._loadedCharacter != null && NOT_NARROWING_TRUE)
				return Promise.resolve();

			// Load the character
			this.load(null);
			Assert(this._loadedCharacter != null);
		}

		this._loadedCharacter.shardReconnect({ shard, accessId, connectionSecret, room });
		return Promise.resolve();
	}
}

export type CharacterAssignment = {
	// Character is assigned to a specific shard and is not in any room
	type: 'shard';
	shard: Shard;
} | {
	// Character is assigned to the same shard the room is, but is not in the room
	// This state is used when joining a room - the character first needs to be loaded on the same shard as the room
	// before joining it, so item-specific room checks can be done without worrying about different versions loaded by different shards
	type: 'room-tracking';
	room: Room;
} | {
	// Character is in the specified room
	type: 'room-joined';
	room: Room;
};

/** This class contains data present for characters ready to be loaded onto a shard */
export class Character {
	protected readonly logger: Logger;

	public readonly baseInfo: CharacterInfo;

	//#region Client connection data

	/** Which client is assigned to this character and receives updates from it; only passive listener to what happens to the character */
	public assignedClient: ClientConnection | null = null;

	/** Secret for client to connect; `null` means this character is only loaded in room, but not connected to ("offline") */
	private _connectSecret: string | null = null;
	public get connectSecret(): string | null {
		return this._connectSecret;
	}

	//#endregion

	//#region Shard and room assignment data

	/** Secret for shard database access */
	public accessId: string = '';

	/**
	 * Definition of shard and room where character should be assigned
	 */
	public assignment: CharacterAssignment | null;

	public get room(): Room | null {
		if (this.assignment?.type === 'room-joined') {
			return this.assignment.room;
		}
		return null;
	}

	/** Which shard this character is currently loaded on */
	public get currentShard(): Shard | null {
		if (this.assignment == null)
			return null;

		if (this.assignment.type === 'shard')
			return this.assignment.shard;

		return this.assignment.room.assignedShard;
	}

	//#endregion

	private get _disposed(): boolean {
		return this.baseInfo.loadedCharacter !== this;
	}

	constructor(baseInfo: CharacterInfo, initialRoom: Room | null) {
		this.logger = GetLogger('Character', `[Character ${baseInfo.id}]`);
		this.baseInfo = baseInfo;
		if (initialRoom != null) {
			// This is for initializing character that is already in a room. It should only be used by the room itself when it loads
			Assert(initialRoom.assignedShard == null);
			initialRoom.trackingCharacters.add(this);
			initialRoom.characters.add(this);
			this.assignment = {
				type: 'room-joined',
				room: initialRoom,
			};
		} else {
			this.assignment = null;
		}
	}

	public isInUse(): boolean {
		return this.assignment != null || this.isOnline();
	}

	public async generateAccessId(): Promise<boolean> {
		this.baseInfo.account.touch();
		const result = await GetDatabase().setCharacterAccess(this.baseInfo.id);
		if (result == null)
			return false;
		this.accessId = result;
		return true;
	}

	//#region Client connection handling

	@AsyncSynchronized('object')
	public async connect(connection: ClientConnection, reconnectSecret?: string): Promise<'ok' | 'noShardFound' | 'failed'> {
		if (this._disposed)
			return 'failed';

		this.baseInfo.account.touch();

		// Remove old connection
		if (this.assignedClient) {
			const c = this.assignedClient;
			c.setCharacter(null);
			c.sendConnectionStateUpdate();
		}
		Assert(this.assignedClient == null);

		// Assign new connection
		const isChange = this._connectSecret == null;
		const newConnection = reconnectSecret == null || this._connectSecret !== reconnectSecret;
		if (newConnection) {
			this._connectSecret = GenerateConnectSecret();
		}
		if (isChange) {
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.relationship.updateStatus();
			if (this.room != null) {
				ConnectionManagerClient.onRoomListChange();
			}
		}

		// If we are already on shard, update the secret on the shard
		if (newConnection) {
			await this.currentShard?.update('characters');
		}

		connection.setCharacter(this);
		connection.sendConnectionStateUpdate();
		Assert(this.assignedClient === connection);

		// Perform action specific to the current assignment
		if (this.assignment == null) {
			// If we have no assignment, then automatically select a shard to assign to
			return await this._assignToShard('auto');
		} else if (this.assignment.type === 'shard') {
			// If we are already on a shard, then done
			return 'ok';
		} else if (this.assignment.type === 'room-tracking' || this.assignment.type === 'room-joined') {
			// If we are in a room, delegate the action to the room
			const roomConnectResult = await this.assignment.room.connect();
			if (typeof roomConnectResult === 'string')
				return roomConnectResult;

			if (isChange && this.assignment.type === 'room-joined')
				this.assignment.room.characterReconnected(this);

			return 'ok';
		}

		AssertNever(this.assignment);
	}

	@AsyncSynchronized('object')
	public async disconnect(): Promise<void> {
		this.baseInfo.account.touch();

		// Detach the client
		if (this.assignedClient) {
			Assert(!this._disposed);
			const c = this.assignedClient;
			c.setCharacter(null);
			c.sendConnectionStateUpdate();
		}
		Assert(this.assignedClient == null);

		// Mark the character as offline
		const isChange = this._connectSecret != null;
		if (isChange) {
			this._connectSecret = null;
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.relationship.updateStatus();
			if (this.room != null) {
				ConnectionManagerClient.onRoomListChange();
			}
		}

		// Perform action specific to the current assignment
		Assert(!this._disposed || this.assignment == null);
		if (this.assignment == null) {
			// If we have no assignment, then there is nothing to do
		} else if (this.assignment.type === 'shard') {
			// If we are already on a shard, then disconnect from it
			await this._unassign();
		} else if (this.assignment.type === 'room-tracking') {
			// If we are tracking a room, then detach from it
			// (only purpose for tracking a room is if we want to make a request to join, which can't happen without a client)
			await this._unassign();
		} else if (this.assignment.type === 'room-joined') {
			// If we are in a room, notify the shard that this character went offline
			await this.currentShard?.update('characters');
			// Notify the room that this character went offline
			if (isChange) {
				this.assignment.room.characterDisconnected(this);
			}
			// Try to perform room cleanup, if applicable
			await this.assignment.room.cleanupIfEmpty();
		} else {
			AssertNever(this.assignment);
		}
	}

	public getShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
		if (!this.currentShard || !this.connectSecret)
			return null;
		return {
			...this.currentShard.getInfo(),
			characterId: this.baseInfo.id,
			secret: this.connectSecret,
		};
	}

	public isOnline(): boolean {
		Assert(!this._disposed || this.connectSecret == null);

		return this.connectSecret != null;
	}

	//#endregion

	//#region Shard and room assignment handling

	public shardReconnect({ shard, accessId, connectionSecret, room }: {
		shard: Shard;
		accessId: string;
		connectionSecret: string | null;
		room: Room | null;
	}): void {
		Assert(!this._disposed);

		if (room != null) {
			// If reconnecting to a room, room should have already done most of the setup
			Assert(this.accessId === accessId);
			Assert(this.room === room);

			// Do the rest
			this._connectSecret = connectionSecret;
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.relationship.updateStatus();

			return;
		}

		Assert(this.assignment == null);

		// Restore access id and connection secret
		this.accessId = accessId;
		this._connectSecret = connectionSecret;
		this.baseInfo.account.onCharacterListChange();
		this.baseInfo.account.relationship.updateStatus();

		// We are ready to connect to shard, but check again if we can to avoid race conditions
		if (!shard.allowConnect()) {
			this.logger.warning('Shard rejects connections during reconnect');
			return;
		}

		// Actually assign to the shard
		this.assignment = {
			type: 'shard',
			shard,
		};
		shard.characters.set(this.baseInfo.id, this);
		this.assignedClient?.sendConnectionStateUpdate();

		this.logger.debug('Re-connected to shard', shard.id);
	}

	@AsyncSynchronized('object')
	public async shardChange(attemptReassign: boolean): Promise<void> {
		if (this.assignment?.type !== 'shard')
			return;

		Assert(!this._disposed);

		await this._unassign();
		if (attemptReassign && this.isOnline()) {
			await this._assignToShard('auto');
		}
	}

	private async _assignToShard(shard: Shard | 'auto'): Promise<'ok' | 'failed' | 'noShardFound'> {
		Assert(this.assignment == null);

		// Generate new access id for new shard
		if (!await this.generateAccessId())
			return 'failed';

		// Automatic shard selection, if requested
		if (shard === 'auto') {
			const randomShard = ShardManager.getRandomShard();
			if (randomShard == null)
				return 'noShardFound';

			shard = randomShard;
		}

		// We are ready to connect to shard, but check again if we can to avoid race conditions
		if (!shard.allowConnect())
			return 'failed';

		// Actually assign to the shard
		this.assignment = {
			type: 'shard',
			shard,
		};
		shard.characters.set(this.baseInfo.id, this);
		await shard.update('characters');
		this.assignedClient?.sendConnectionStateUpdate();

		this.logger.debug('Connected to shard', shard.id);
		return 'ok';
	}

	private async _assignToRoom(room: Room): Promise<'ok' | 'failed'> {
		Assert(this.assignment == null);

		// Generate new access id for new shard (so the assignment works well when interleaved with room's `_setShard` assignment step)
		if (!await this.generateAccessId())
			return 'failed';

		const targetShard = room.assignedShard;
		// We are ready to connect to shard, but check again if we can to avoid race conditions
		if (targetShard != null && !targetShard.allowConnect())
			return 'failed';

		// Track the room
		this.assignment = {
			type: 'room-tracking',
			room,
		};
		room.trackingCharacters.add(this);

		// Assign ourselves to the shard, if there is one
		if (targetShard != null) {
			targetShard.characters.set(this.baseInfo.id, this);
			await targetShard.update('characters');
			this.assignedClient?.sendConnectionStateUpdate();
			this.logger.debug('Connected to shard', targetShard.id);
		}

		return 'ok';
	}

	private async _unassign(): Promise<void> {
		// If there is no assignment, there is nothing to do
		if (this.assignment == null)
			return;

		// If we are in a room, we cannot unassign (room leave needs to be performed instead)
		if (this.assignment.type === 'room-joined') {
			throw new Error('Cannot unassign character that is inside a room');
		}

		// Perform cleanup based on current assignment
		if (this.assignment.type === 'room-tracking') {
			const room = this.assignment.room;
			const shard = room.assignedShard;

			// Detach from the room
			room.trackingCharacters.delete(this);
			this.assignment = null;
			this.assignedClient?.sendConnectionStateUpdate();

			// Disconnect from a shard, if there is one
			if (shard != null) {
				Assert(shard.characters.get(this.baseInfo.id) === this);
				shard.characters.delete(this.baseInfo.id);
				await shard.update('characters');
			}

			// Check if room can be cleaned up
			await room.cleanupIfEmpty();
		} else if (this.assignment.type === 'shard') {
			const shard = this.assignment.shard;

			this.assignment = null;
			this.assignedClient?.sendConnectionStateUpdate();

			Assert(shard.characters.get(this.baseInfo.id) === this);
			shard.characters.delete(this.baseInfo.id);
			await shard.update('characters');
		} else {
			AssertNever(this.assignment);
		}

		Assert(this.assignment == null);
	}

	/**
	 * Handles the case where character has error while loading or loaded on shard and needs to be forcefully removed
	 * This allows rest of the room (if in a room) to function properly
	 */
	@AsyncSynchronized('object')
	public async forceDisconnectShard(): Promise<void> {
		if (this._disposed)
			return;

		// Force remove from a room, if necessary
		// Must be in a room (otherwise success)
		const oldAssignment = this.assignment;
		if (oldAssignment?.type === 'room-joined') {
			const oldRoom = oldAssignment.room;

			// Actually remove the character from the room
			await oldRoom.removeCharacter(this, 'error', this.baseInfo);
		}

		// Disconnect
		await this._unassign();
	}

	@AsyncSynchronized('object')
	public async joinRoom(room: Room, password: string | null): Promise<'failed' | 'ok' | 'errFull' | 'noAccess' | 'invalidPassword'> {
		// Only loaded characters can request room join
		if (!this.isOnline())
			return 'failed';

		// Must not be in a different room (TODO: Shift the automatic leaving logic here)
		if (this.room != null)
			return 'failed';

		// Must be allowed to join the room (quick check before attempt, also ignores full room, as that will be handled by second check)
		const allowResult1 = room.checkAllowEnter(this, password, true);

		if (allowResult1 !== 'ok') {
			return allowResult1;
		}

		// Must connect to the same shard as the room to check character-based join requirements
		await this._unassign();
		const assignResult = await this._assignToRoom(room);

		if (assignResult !== 'ok')
			return assignResult;

		// The room must be loaded on a shard for this to work, request that
		const shard = await room.connect();
		if (shard === 'failed' || shard === 'noShardFound')
			return 'failed';

		// If we have no connection, fail (this is most likely an intermittent failure during room moving shards, unless there are no shards or the room is failing to load)
		if (shard?.shardConnection == null)
			return 'failed';

		// Must be allowed to join room based on character restrictions (ask shard)
		const restrictionResult = await shard.shardConnection.awaitResponse('roomCheckCanEnter', {
			character: this.baseInfo.id,
			room: room.id,
		}).catch(() => undefined);

		// Check if the query was successful
		if (restrictionResult == null || restrictionResult.result === 'targetNotFound') {
			// Fail on intermittent failures (no connection to shard, the request failed, the shard doesn't recognize this client (e.g. was disconnected during this request))
			return 'failed';
		}

		if (restrictionResult.result === 'ok') {
			// NOOP (fallthough)
		} else {
			AssertNever(restrictionResult.result);
		}

		// Must be allowed to join the room (second check to prevent race conditions)
		const allowResult2 = room.checkAllowEnter(this, password);

		if (allowResult2 !== 'ok') {
			return allowResult2;
		}

		// Actually add the character to the room
		await room.addCharacter(this);

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async leaveRoom(): Promise<'ok' | 'failed' | 'restricted' | 'inRoomDevice'> {
		// Only loaded characters can request room leave
		if (!this.isOnline())
			return 'failed';

		// Must be in a room (otherwise success)
		const oldAssignment = this.assignment;
		if (oldAssignment?.type !== 'room-joined')
			return 'ok';

		const oldRoom = oldAssignment.room;
		const shard = oldRoom.assignedShard;

		// If we have no connection, fail (this is most likely an intermittent failure during room moving shards, unless there are no shards or the room is failing to load)
		if (shard?.shardConnection == null)
			return 'failed';

		// Must be allowed to leave room based on character restrictions (ask shard)
		const restrictionResult = await shard.shardConnection?.awaitResponse('roomCheckCanLeave', {
			character: this.baseInfo.id,
		}).catch(() => undefined);

		// Check if the query was successful
		if (restrictionResult == null || restrictionResult.result === 'targetNotFound') {
			// Fail on intermittent failures (no connection to shard, the request failed, the shard doesn't recognize this client (e.g. was disconnected during this request))
			return 'failed';
		}

		switch (restrictionResult.result) {
			case 'ok':
				// NOOP (fallthough)
				break;
			case 'restricted':
				return 'restricted';
			case 'inRoomDevice':
				return 'inRoomDevice';
			default:
				AssertNever(restrictionResult.result);
		}

		// Actually remove the character from the room
		await oldRoom.removeCharacter(this, 'leave', this.baseInfo);

		// Cleanup the assignment
		Assert(this.assignment?.type === 'room-tracking' && this.assignment.room === oldRoom);
		oldRoom.trackingCharacters.delete(this);
		this.assignment = {
			type: 'shard',
			shard,
		};

		// Check if room can be cleaned up
		await oldRoom.cleanupIfEmpty();

		return 'ok';
	}
}
