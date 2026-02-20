import { cloneDeep } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	Assert,
	AssertNever,
	AsyncSynchronized,
	CharacterId,
	CloneDeepMutable,
	GetLogger,
	IDirectoryCharacterAssignmentInfo,
	Logger,
	NOT_NARROWING_FALSE,
	NOT_NARROWING_TRUE,
	SpaceId,
	SpaceInviteId,
	type ICharacterData,
	type ICharacterDataDirectoryUpdate,
	type ManagementAccountInfoCharacter,
} from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider.ts';
import type { DatabaseCharacterSelfInfo } from '../database/databaseStructure.ts';
import type { ClientConnection } from '../networking/connection_client.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import type { Shard } from '../shard/shard.ts';
import { ShardManager } from '../shard/shardManager.ts';
import type { Space } from '../spaces/space.ts';
import { SpaceManager } from '../spaces/spaceManager.ts';
import type { SpaceSwitchCoordinator } from '../spaces/spaceSwitch.ts';
import type { Account } from './account.ts';

function GenerateConnectSecret(): string {
	return nanoid(8);
}

export class CharacterInfo {
	public readonly id: CharacterId;
	public readonly account: Account;
	protected readonly logger: Logger;

	protected _data: Readonly<DatabaseCharacterSelfInfo>;
	public get data(): Readonly<DatabaseCharacterSelfInfo> {
		return this._data;
	}

	private _loadedCharacter: Character | null = null;
	public get loadedCharacter(): Character | null {
		return this._loadedCharacter;
	}

	public get isValid(): boolean {
		return !this._invalid;
	}
	private _invalid: boolean = false;

	constructor(characterData: DatabaseCharacterSelfInfo, account: Account) {
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
		if (this._invalid)
			return 'invalid';

		if (this.isOnline())
			return 'connected';

		if (this.inCreation)
			return 'inCreation';

		return '';
	}

	public getAdminInfo(): Readonly<ManagementAccountInfoCharacter> {
		return cloneDeep<ManagementAccountInfoCharacter>({
			...this.data,
			state: this.getInfoState(),
		});
	}

	@AsyncSynchronized('object')
	public async finishCharacterCreation(): Promise<Pick<ICharacterData, 'id' | 'name' | 'created'> | null> {
		if (this._invalid || !this.inCreation)
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

	@AsyncSynchronized() // Synchronized intentionally only w.r.t itself
	public async updateDirectoryData(update: ICharacterDataDirectoryUpdate): Promise<void> {
		if (this._invalid)
			return;

		const result = await GetDatabase().updateCharacter(this.id, update, null);
		if (!result)
			throw new Error('Database update failed');

		this._data = {
			...this._data,
			...update,
		};
	}

	@AsyncSynchronized()
	public async requestLoad(): Promise<Character | null> {
		if (this._invalid)
			return null;

		if (this._loadedCharacter != null && NOT_NARROWING_TRUE)
			return this._loadedCharacter;

		const currentSpaceId: SpaceId | null = this._data.currentSpace ?? null;
		if (currentSpaceId != null) {
			// If we want to load into a space, load it
			const space = await SpaceManager.loadSpace(currentSpaceId);
			if (space != null) {
				// If there is a space, check we were loaded into it
				Assert(this._loadedCharacter != null);
				return this._loadedCharacter;
			}
			// If the space failed to load, kick the character out of it
			this.logger.warning('Failed to load current space, force-kick');
			await this.updateDirectoryData({ currentSpace: null });
			// Fallthrough to behaviour outside of a space
		}

		// Load the character without a specified space
		this.load(null);
		Assert(this._loadedCharacter != null);
		return this._loadedCharacter;
	}

	public load(space: Space | null): void {
		Assert(this._loadedCharacter == null);
		// This should only happen if unloaded space the character is in is being loaded.
		// If the character is invalid, simply ignore the load (it will get skipped by the space)
		if (this._invalid)
			return;

		this._loadedCharacter = new Character(this, space);
		this.logger.debug(`Loaded`);
	}

	public trackedSpaceUnload(space: Space): void {
		const oldCharacter = this._loadedCharacter;
		// Can only be perfromed when loaded and tracking specified space
		Assert(oldCharacter != null);
		Assert(oldCharacter.assignment?.type === 'space-joined' || oldCharacter.assignment?.type === 'space-tracking');
		Assert(oldCharacter.assignment.space === space);
		// The space shouldn't unload when any character is requesting it to be loaded or is loaded on a shard
		Assert(oldCharacter.connectSecret == null);
		Assert(oldCharacter.assignedClient == null);
		Assert(oldCharacter.currentShard == null);

		// Cleanup links to the space to allow it to properly unload
		space.trackingCharacters.delete(oldCharacter);
		oldCharacter.assignment = null;

		// Finish unload
		this._loadedCharacter = null;
		this.logger.debug(`Unloaded (trackedSpaceUnload)`);
	}

	@AsyncSynchronized('object')
	public shardReconnect({ shard, accessId, connectionSecret, space }: {
		shard: Shard;
		accessId: string;
		connectionSecret: string | null;
		space: Space | null;
	}): Promise<void> {
		// Ignore if the character is invalidated - the reconnecting shard will simply get updated to exclude this character
		if (this._invalid)
			return Promise.resolve();

		// If we are in a space, the character should have already been loaded by the space
		if (space != null) {
			Assert(this._loadedCharacter != null);
		} else {
			// Someone else might have loaded the character meanwhile
			if (this._loadedCharacter != null && NOT_NARROWING_TRUE)
				return Promise.resolve();

			// Load the character
			this.load(null);
			Assert(this._loadedCharacter != null);
		}

		this._loadedCharacter.shardReconnect({ shard, accessId, connectionSecret, space });
		return Promise.resolve();
	}

	/**
	 * This method will forcefully unload the character, removing it from any space it is in in the process.
	 * It is only guaranteed that the character will be unloaded during this.
	 * It is not guaranteed that they will not be loaded again even before this method returns.
	 * @param markInvalid - If the character should be attempted to be marked as "invalid", preventing future loads.
	 * This might not succeed and will be ignored in that case.
	 */
	@AsyncSynchronized('object')
	public async forceUnload(markInvalid = false): Promise<void> {
		// Check if we are already done
		if (this._invalid)
			return;

		const oldCharacter = this._loadedCharacter;

		if (oldCharacter != null) {
			await oldCharacter.forceDisconnectShard();

			// Fail if the character got loaded again after the force disconnect
			if (oldCharacter.isInUse()) {
				return;
			}

			Assert(this._loadedCharacter === oldCharacter);
			// The character should be completely unloaded by this point (not in any space, not on any shard, or assigned to any client)
			Assert(oldCharacter.assignment == null);
			Assert(oldCharacter.connectSecret == null);
			Assert(oldCharacter.assignedClient == null);
			Assert(oldCharacter.currentShard == null);

			// Finish unload
			this._loadedCharacter = null;
			this.logger.debug(`Unloaded (forceUnload)`);
		}

		// If the unload was successful and invalidation was requested, mark this character as invalid
		if (markInvalid && this._loadedCharacter == null) {
			this._invalid = true;
		}
	}
}

export type CharacterAssignment = {
	// Character is assigned to a specific shard and is in personal space
	type: 'shard';
	shard: Shard;
} | {
	// Character is assigned to the same shard the space is, but is not in the space, but in personal space
	// This state is used when joining a public space - the character first needs to be loaded on the same shard as the space
	// before joining it, so item-specific checks can be done without worrying about different versions loaded by different shards
	type: 'space-tracking';
	space: Space;
} | {
	// Character is in the specified space
	type: 'space-joined';
	space: Space;
};

/** This class contains data present for characters ready to be loaded onto a shard */
export class Character {
	protected readonly logger: Logger;

	public readonly baseInfo: CharacterInfo;

	//#region Client connection data

	/** Which client is assigned to this character and receives updates from it; only passive listener to what happens to the character */
	public assignedClient: ClientConnection | null = null;

	/** Secret for client to connect; `null` means this character is only loaded in a space, but not connected to by a client ("offline") */
	private _connectSecret: string | null = null;
	public get connectSecret(): string | null {
		return this._connectSecret;
	}

	//#endregion

	//#region Shard and space assignment data

	/** Secret for shard database access */
	public accessId: string = '';

	/**
	 * Definition of shard and space where character should be assigned
	 */
	public assignment: CharacterAssignment | null;

	/**
	 * If this is set, it is valid to return character assignment with no shard.
	 * This in turn produces load screen on client as it waits for servers to get ready.
	 * This should always be cleared when leaving synchronized context of this class,
	 * in which case no character info should be returned at all if there is no active assignment,
	 * in effect sending client to the character selection screen, letting us gracefully recover from assignment errors by letting user re-select the character.
	 */
	private _assignmentChangePending: boolean = false;

	public get space(): Space | null {
		if (this.assignment?.type === 'space-joined') {
			return this.assignment.space;
		}
		return null;
	}

	/** Which shard this character is currently loaded on */
	public get currentShard(): Shard | null {
		if (this.assignment == null)
			return null;

		if (this.assignment.type === 'shard')
			return this.assignment.shard;

		return this.assignment.space.assignedShard;
	}

	//#endregion

	private _toBeDisconnected: boolean = false;
	public get toBeDisconnected(): boolean {
		return this._toBeDisconnected;
	}

	private get _disposed(): boolean {
		return this.baseInfo.loadedCharacter !== this;
	}

	constructor(baseInfo: CharacterInfo, initialSpace: Space | null) {
		this.logger = GetLogger('Character', `[Character ${baseInfo.id}]`);
		this.baseInfo = baseInfo;
		if (initialSpace != null) {
			// This is for initializing character that is already in a space. It should only be used by the space itself when it loads
			Assert(initialSpace.assignedShard == null);
			initialSpace.trackingCharacters.add(this);
			initialSpace.characters.add(this);
			this.assignment = {
				type: 'space-joined',
				space: initialSpace,
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
			this.baseInfo.account.contacts.updateStatus();
			if (this.space != null) {
				this.space.updateActivityData();
				ConnectionManagerClient.onSpaceListChange();
			}
		}

		// If we are already on shard, update the secret on the shard
		if (newConnection) {
			await this.currentShard?.update('characters');
		}

		// Race-condition check - check that the connection is still valid and logged in
		if (connection.isConnected() && connection.account === this.baseInfo.account) {
			// If yes, assign this character to the connection
			// If no, then continue anyway (the character will later timeout on shard and disconnect automatically)
			connection.setCharacter(this);
			connection.sendConnectionStateUpdate();
			Assert(this.assignedClient === connection);
		}

		// Perform action specific to the current assignment
		if (this.assignment == null) {
			// If we have no assignment, then automatically select a shard to assign to
			return await this._assignToShard('auto');
		} else if (this.assignment.type === 'shard') {
			// If we are already on a shard, then done
			return 'ok';
		} else if (this.assignment.type === 'space-tracking' || this.assignment.type === 'space-joined') {
			// If we are in a space, delegate the action to the space
			const spaceConnectResult = await this.assignment.space.connect();
			if (typeof spaceConnectResult === 'string')
				return spaceConnectResult;

			if (isChange && this.assignment.type === 'space-joined')
				this.assignment.space.characterReconnected(this);

			return 'ok';
		}

		AssertNever(this.assignment);
	}

	public markForDisconnect(): void {
		this._toBeDisconnected = true;
	}

	@AsyncSynchronized('object')
	public async disconnect(): Promise<void> {
		this._toBeDisconnected = false;
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
			if (this.space != null) {
				// Update space activity right before going offline, so this character still counts as active at the last moment
				this.space.updateActivityData();
			}

			this._connectSecret = null;
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.contacts.updateStatus();
			if (this.space != null) {
				ConnectionManagerClient.onSpaceListChange();
			}
		}

		// Perform action specific to the current assignment
		Assert(!this._disposed || this.assignment == null);
		if (this.assignment == null) {
			// If we have no assignment, then there is nothing to do
		} else if (this.assignment.type === 'shard') {
			// If we are already on a shard, then disconnect from it
			await this._unassign();
		} else if (this.assignment.type === 'space-tracking') {
			// If we are tracking a space, then detach from it
			// (only purpose for tracking a space is if we want to make a request to join, which can't happen without a client)
			await this._unassign();
		} else if (this.assignment.type === 'space-joined') {
			// If we are in a space, notify the shard that this character went offline
			await this.currentShard?.update('characters');
			// Notify the space that this character went offline
			if (isChange) {
				this.assignment.space.characterDisconnected(this);
			}
			// Try to perform space cleanup, if applicable
			await this.assignment.space.cleanupIfEmpty();
		} else {
			AssertNever(this.assignment);
		}
	}

	public getShardAssignmentInfo(): IDirectoryCharacterAssignmentInfo | null {
		if (!this._assignmentChangePending && (!this.currentShard || !this.connectSecret))
			return null;

		return {
			characterId: this.baseInfo.id,
			shardConnection: (this.currentShard && this.connectSecret) ? {
				...this.currentShard.getInfo(),
				secret: this.connectSecret,
			} : null,
		};
	}

	public isOnline(): boolean {
		Assert(!this._disposed || this.connectSecret == null);

		return this.connectSecret != null;
	}

	//#endregion

	//#region Shard and space assignment handling

	public shardReconnect({ shard, accessId, connectionSecret, space }: {
		shard: Shard;
		accessId: string;
		connectionSecret: string | null;
		space: Space | null;
	}): void {
		Assert(!this._disposed);

		if (space != null) {
			// If reconnecting to a space, it should have already done most of the setup
			Assert(this.accessId === accessId);
			Assert(this.space === space);

			// Do the rest
			this._connectSecret = connectionSecret;
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.contacts.updateStatus();

			return;
		}

		Assert(this.assignment == null);

		// Restore access id and connection secret
		this.accessId = accessId;
		this._connectSecret = connectionSecret;
		this.baseInfo.account.onCharacterListChange();
		this.baseInfo.account.contacts.updateStatus();

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

	private async _unassign(): Promise<void> {
		// If there is no assignment, there is nothing to do
		if (this.assignment == null)
			return;

		// If we are in a space, we cannot unassign (space leave needs to be performed instead)
		if (this.assignment.type === 'space-joined') {
			throw new Error('Cannot unassign character that is inside a space');
		}

		// Perform cleanup based on current assignment
		if (this.assignment.type === 'space-tracking') {
			const space = this.assignment.space;
			const shard = space.assignedShard;

			// Detach from the space
			space.trackingCharacters.delete(this);
			this.assignment = null;
			this.assignedClient?.sendConnectionStateUpdate();

			// Disconnect from a shard, if there is one
			if (shard != null) {
				Assert(shard.characters.get(this.baseInfo.id) === this);
				shard.characters.delete(this.baseInfo.id);
				await shard.update('characters');
			}

			// Check if space can be cleaned up
			await space.cleanupIfEmpty();
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
	 * This allows rest of the space (if in one) to function properly
	 */
	@AsyncSynchronized('object')
	public async forceDisconnectShard(): Promise<void> {
		if (this._disposed)
			return;

		// Force remove from a space, if necessary
		// Must be in a space (otherwise success)
		const oldAssignment = this.assignment;
		if (oldAssignment?.type === 'space-joined') {
			const oldSpace = oldAssignment.space;

			// Actually remove the character from the space
			await oldSpace.removeCharacter(this, 'error', this.baseInfo);
		}

		// Disconnect
		await this._unassign();

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
			if (this.space != null) {
				// Update space activity right before going offline, so this character still counts as active at the last moment
				this.space.updateActivityData();
			}

			this._connectSecret = null;
			this.baseInfo.account.onCharacterListChange();
			this.baseInfo.account.contacts.updateStatus();
			if (this.space != null) {
				ConnectionManagerClient.onSpaceListChange();
			}
		}
	}

	private async _switchSpace(space: Space | null, invite?: SpaceInviteId, coordinator?: SpaceSwitchCoordinator): Promise<'failed' | 'ok' | 'spaceFull' | 'noAccess' | 'invalidInvite' | 'restricted' | 'inRoomDevice'> {
		// Only loaded characters can request leaving a space
		if (!this.isOnline())
			return 'failed';

		if (coordinator != null) {
			Assert(coordinator.newSpace === space);

			if (coordinator.originalSpace !== this.space)
				return 'failed';

			await coordinator.switchSynchronize(this, 'syncLock');
			if (coordinator.canceled)
				return 'failed';
		}

		// Short-circuit no change
		if (this.space === space)
			return 'ok';

		// If we are aiming to join a public space, then run early checks for being able to enter it to avoid leaving if it wouldn't be possible anyway
		if (space != null) {
			// Must be allowed to join the space
			const allowResult1 = space.checkAllowEnter(this, {
				inviteId: invite,
				assumeValidInvite: coordinator?.assumeInvite ?? false,
				ignoreCharacterLimit: coordinator?.ignoreCharacterLimit ?? false,
			});

			if (allowResult1 !== 'ok') {
				return allowResult1;
			}
		}

		if (coordinator != null) {
			await coordinator.switchSynchronize(this, 'enterPrecheck');
			if (coordinator.canceled)
				return 'failed';
		}

		// If we are in a public space, leave it first
		const oldAssignment = this.assignment;
		if (oldAssignment?.type === 'space-joined') {
			const oldSpace = oldAssignment.space;
			const shardForLeaveCheck = oldSpace.assignedShard;

			// If we have no connection, fail (this is most likely an intermittent failure during a space moving shards, unless there are no shards or the space is failing to load)
			if (shardForLeaveCheck?.shardConnection == null)
				return 'failed';

			// Must be allowed to leave the space based on character restrictions (ask shard)
			const restrictionResult = await shardForLeaveCheck.shardConnection?.awaitResponse('spaceCheckCanLeave', {
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

			if (coordinator != null) {
				await coordinator.switchSynchronize(this, 'beforeLeave');
				if (coordinator.canceled)
					return 'failed';
			}

			// Actually remove the character from the space
			await oldSpace.removeCharacter(this, 'leave', this.baseInfo, () => {
				// Update assignment to make this switch atomic instead of loading into personal space, when switching between two public spaces
				Assert(this.space == null);

				if (this.assignment != null) {
					Assert(this.assignment.type === 'shard');
					const oldShard = this.assignment.shard;

					this.assignment = null;
					this.assignedClient?.sendConnectionStateUpdate();

					Assert(oldShard.characters.get(this.baseInfo.id) === this);
					oldShard.characters.delete(this.baseInfo.id);
					// We intentionally do not trigger update of the shard - that will be done by `removeCharacter` after leaving this hook.
				}
			});

			// Clean up old space, if it has no more characters
			await oldSpace.cleanupIfEmpty();
		} else {
			if (coordinator != null) {
				await coordinator.switchSynchronize(this, 'beforeLeave');
				if (coordinator.canceled)
					return 'failed';
			}

			// If in personal space, simply unload
			await this._unassign();
		}

		Assert(this.space == null);
		Assert(this.assignment == null);
		if (coordinator != null) {
			await coordinator.switchSynchronize(this, 'left');
			if (coordinator.canceled)
				return 'failed';
		}

		if (space != null) {
			// If we are joining a public space, then run checks for being able to enter it

			// Must be allowed to join the space (second check to prevent race conditions)
			const allowResult2 = space.checkAllowEnter(this, {
				inviteId: invite,
				assumeValidInvite: coordinator?.assumeInvite ?? false,
				ignoreCharacterLimit: coordinator?.ignoreCharacterLimit ?? false,
			});
			if (allowResult2 !== 'ok') {
				// Load us into personal space if second access check failed
				await this._assignToShard('auto');
				return allowResult2;
			}

			if (coordinator != null) {
				await coordinator.switchSynchronize(this, 'beforeEnter');
				if (coordinator.canceled)
					return 'failed';
			}

			// Prepare for connection to the shard and start tracking the space (do not actually connect yet)

			// Generate new access id for new shard (so the assignment works well when interleaved with space's `_setShard` assignment step)
			if (!await this.generateAccessId())
				return 'failed';

			const targetShard = space.assignedShard;
			// We are ready to connect to shard, but check again if we can to avoid race conditions
			if (targetShard != null && !targetShard.allowConnect())
				return 'failed';

			// Track the space
			this.assignment = {
				type: 'space-tracking',
				space,
			};
			space.trackingCharacters.add(this);

			// Assign ourselves to the shard, if there is one
			if (targetShard != null) {
				targetShard.characters.set(this.baseInfo.id, this);
				// We intentionally delay updating the shard to prevent load into personal space if switching two spaces
				this.logger.debug('Connecting to shard', targetShard.id);
			}

			// Actually add the character to the space
			if (!await space.addCharacter(this, invite)) {
				// Load us into personal space if actual join failed
				await this._unassign();
				await this._assignToShard('auto');
				return 'failed';
			}
			Assert(NOT_NARROWING_FALSE || this.space === space);

			// Request the space to load
			const shard = await space.connect();

			// Inform client about connection update (connect doesn't do that in all code paths)
			this.assignedClient?.sendConnectionStateUpdate();

			if (shard === 'failed' || shard === 'noShardFound')
				return 'failed';

		} else {
			if (coordinator != null) {
				await coordinator.switchSynchronize(this, 'beforeEnter');
				if (coordinator.canceled)
					return 'failed';
			}

			// If we loading into personal space, simply load onto any shard
			const loadResult = await this._assignToShard('auto');
			if (loadResult !== 'ok')
				return 'failed';
		}

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async switchSpace(space: Space | null, invite?: SpaceInviteId, coordinator?: SpaceSwitchCoordinator): Promise<'failed' | 'ok' | 'spaceFull' | 'noAccess' | 'invalidInvite' | 'restricted' | 'inRoomDevice'> {
		Assert(!this._assignmentChangePending);

		this._assignmentChangePending = true;
		try {
			return await this._switchSpace(space, invite, coordinator);
		} finally {
			this._assignmentChangePending = false;
			// If changing this flag can change the state, re-send it
			if (!this.currentShard || !this.connectSecret) {
				this.assignedClient?.sendConnectionStateUpdate();
			}
		}
	}
}
