import { Assert, AssertNever, AssertNotNullable, AsyncSynchronized, CharacterId, CloneDeepMutable, GetLogger, ICharacterData, ICharacterSelfInfo, ICharacterSelfInfoUpdate, IDirectoryCharacterConnectionInfo, Logger } from 'pandora-common';
import type { Account } from './account';
import type { Shard } from '../shard/shard';
import type { Room } from '../room/room';
import type { ClientConnection } from '../networking/connection_client';
import { GetDatabase, ICharacterSelfInfoDb } from '../database/databaseProvider';
import { nanoid } from 'nanoid';
import { ShardManager } from '../shard/shardManager';

export type CharacterShardSelector = {
	type: 'shard';
	shard: Shard;
} | {
	type: 'room';
	room: Room;
};

function GenerateConnectSecret(): string {
	return nanoid(8);
}

export class Character {
	public readonly id: CharacterId;
	public readonly account: Account;
	protected readonly logger: Logger;

	protected _data: Readonly<ICharacterSelfInfoDb>;
	public get data(): Readonly<ICharacterSelfInfoDb> {
		return this._data;
	}

	public accessId: string = '';
	public connectSecret: string;

	private _assignedConnection: ClientConnection | null = null;

	/** Which client is assigned to this character and receives updates from it; only passive listener to what happens to the character */
	public get assignedConnection(): ClientConnection | null {
		return this._assignedConnection;
	}

	public set assignedConnection(value: ClientConnection | null) {
		if (this._assignedConnection !== value) {
			this._assignedConnection = value;
		}
	}

	private _room: Room | null = null;

	/** Which room this character is in */
	public get room(): Room | null {
		return this._room;
	}

	public set room(value: Room | null) {
		if (this._room !== value) {
			this._room = value;
			this.account.relationship.updateStatus();
		}
	}

	/**
	 * Selector for which shard this character wants to follow.
	 *
	 * If `room` is not null, then this must match the room.
	 */
	private _shardSelector: CharacterShardSelector | null = null;
	public get shardSelector(): CharacterShardSelector | null {
		return this._shardSelector;
	}

	/** Which shard this character is currently loaded on; requires `_shardSelector` not to be null and must always match it */
	private _assignedShard: Shard | null = null;

	constructor(characterData: ICharacterSelfInfoDb, account: Account) {
		this.logger = GetLogger('Character', `[Character ${characterData.id}]`);
		this.id = characterData.id;
		this.account = account;
		this._data = characterData;
		this.connectSecret = GenerateConnectSecret();
	}

	public isInUse(): boolean {
		return this._assignedShard != null;
	}

	public get inCreation(): boolean {
		return !!this.data.inCreation;
	}

	@AsyncSynchronized('object')
	public async disconnect(): Promise<void> {
		this.account.touch();
		if (this.room) {
			await this.room.removeCharacter(this, 'disconnect', null);
		}
		const disconnectRes = await this._setShardSelector(null);
		Assert(disconnectRes === 'ok');
	}

	private async generateAccessId(): Promise<void> {
		this.account.touch();
		const result = await GetDatabase().setCharacterAccess(this.id);
		AssertNotNullable(result);
		this.accessId = result;
	}

	public getShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
		if (!this._assignedShard)
			return null;
		return {
			...this._assignedShard.getInfo(),
			characterId: this.id,
			secret: this.connectSecret,
		};
	}

	public onAccountInfoChange(): void {
		this._assignedShard?.update('characters').catch(() => { /* NOOP */ });
	}

	public getInfoState(): string {
		if (this.isInUse())
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
	public async updateSelfData(update: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfo | null> {
		const info = await GetDatabase().updateCharacter(this.account.id, update);
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

	@AsyncSynchronized('object')
	public async connect(connection: ClientConnection): Promise<'ok' | 'noShardFound' | 'failed'> {
		// Remove old connection
		if (this.assignedConnection) {
			const c = this.assignedConnection;
			c.setCharacter(null);
			c.sendConnectionStateUpdate();
		}

		// Assign new connection
		this.connectSecret = GenerateConnectSecret();

		// If we are already on shard, update the secret on the shard
		await this._assignedShard?.update('characters');

		connection.setCharacter(this);
		connection.sendConnectionStateUpdate();

		// If we are already on shard, we are done
		if (this._assignedShard)
			return 'ok';

		return await this._autoconnect();
	}

	@AsyncSynchronized('object')
	public async shardReconnect({ shard, accessId, connectionSecret, room }: {
		shard: Shard;
		accessId: string;
		connectionSecret: string;
		room?: Room;
	}): Promise<void> {
		if (this.isInUse() || this._shardSelector != null || this.room != null || (this.accessId && this.accessId !== accessId))
			return;

		this.connectSecret = connectionSecret;
		this.assignedConnection?.sendConnectionStateUpdate();

		const selector: CharacterShardSelector = room ? {
			type: 'room',
			room,
		} : {
			type: 'shard',
			shard,
		};

		const connectRes = await this._setShardSelector(selector, accessId);
		if (room && connectRes === 'ok') {
			// On shard reconnect we ignore most checks, as shard says user already is in the room
			await room.addCharacter(this, false);
		}
	}

	@AsyncSynchronized('object')
	public autoconnect(): Promise<'ok' | 'noShardFound' | 'failed'> {
		return this._autoconnect();
	}

	private async _autoconnect(): Promise<'ok' | 'noShardFound' | 'failed'> {
		let selector: CharacterShardSelector | undefined;

		if (this._shardSelector) {
			selector = this._shardSelector;
		} else if (this.room) {
			selector = {
				type: 'room',
				room: this.room,
			};
		} else if (this._assignedShard) {
			selector = {
				type: 'shard',
				shard: this._assignedShard,
			};
		} else {
			const shard = ShardManager.getRandomShard();
			if (shard) {
				selector = {
					type: 'shard',
					shard,
				};
			}
		}

		if (!selector) {
			return 'noShardFound';
		}

		return await this._setShardSelector(selector);
	}

	private async _setShardSelector(selector: CharacterShardSelector | null, forceAccessId?: string): Promise<'ok' | 'failed'> {
		this.account.touch();

		let shard: Shard | null;

		// If we are in a room, the selector's room must match it
		if (this.room != null && (selector?.type !== 'room' || selector.room !== this.room))
			return 'failed';

		if (selector?.type === 'room') {
			// If in a room, the room always chooses shard
			const roomShard = await selector.room.connect();
			if (typeof roomShard === 'string')
				return 'failed';
			shard = roomShard;
		} else if (selector?.type === 'shard') {
			// Cannot connect to specific shard if we are in a room
			if (this.room != null)
				return 'failed';
			shard = selector.shard;
		} else if (selector == null) {
			shard = null;
		} else {
			AssertNever(selector);
		}

		// Shortcut: We are on correct shard already
		if (this._assignedShard === shard) {
			this._shardSelector = selector;
			return 'ok';
		}

		// Cleanup old selector and connection
		await this._setShard(null);
		if (this._shardSelector) {
			this._shardSelector = null;
		}

		// Check that we can actually join the shard (prevent race condition on shard shutdown)
		if (shard != null && !shard.allowConnect()) {
			return 'failed';
		}

		// Set the selector
		Assert(this._assignedShard == null || shard === this._assignedShard);
		this._shardSelector = selector;

		// Connect to the wanted shard
		if (this._assignedShard !== shard) {
			await this._setShard(shard, forceAccessId);
		}

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async setShard(shard: Shard | null, forceAccessId?: string): Promise<void> {
		return this._setShard(shard, forceAccessId);
	}

	private async _setShard(shard: Shard | null, forceAccessId?: string): Promise<void> {
		if (forceAccessId) {
			AssertNotNullable(shard);
		}
		if (this._assignedShard === shard)
			return;
		if (this._assignedShard) {
			const oldShard = this._assignedShard;
			Assert(oldShard.getConnectedCharacter(this.id) === this);

			oldShard.characters.delete(this.id);
			this._assignedShard = null;
			this.account.onCharacterListChange();
			this.assignedConnection?.sendConnectionStateUpdate();

			await oldShard.update('characters');

			this.logger.debug('Disconnected from shard');
		}
		if (shard) {
			Assert(this._assignedShard === null);
			Assert(shard.allowConnect(), 'Connecting to shard that doesn\'t allow connections');
			Assert(
				this._shardSelector?.type === 'shard' && this._shardSelector.shard === shard ||
				this._shardSelector?.type === 'room' && this._shardSelector.room.assignedShard === shard,
			);

			// Generate new access id for new shard
			if (forceAccessId) {
				this.accessId = forceAccessId;
			} else {
				await this.generateAccessId();
			}

			this._assignedShard = shard;
			shard.characters.set(this.id, this);
			this.account.onCharacterListChange();

			await shard.update('characters');
			this.assignedConnection?.sendConnectionStateUpdate();

			this.logger.debug('Connected to shard', shard.id);
		}
	}

	@AsyncSynchronized('object')
	public async joinRoom(room: Room, sendEnterMessage: boolean, password: string | null): Promise<'failed' | 'ok' | 'errFull' | 'noAccess' | 'invalidPassword'> {
		return await this._joinRoom(room, sendEnterMessage, password);
	}

	private async _joinRoom(room: Room, sendEnterMessage: boolean, password: string | null): Promise<'failed' | 'ok' | 'errFull' | 'noAccess' | 'invalidPassword'> {
		// Must not be in a different room (TODO: Shift the logic here)
		if (this.room != null)
			return 'failed';

		// Must be allowed to join the room (quick check before attempt, also ignores full room, as that will be handled by second check)
		const allowResult1 = room.checkAllowEnter(this, password, true);

		if (allowResult1 !== 'ok') {
			return allowResult1;
		}

		// Must already be tracking the correct room
		const selectorResult = await this._setShardSelector({
			type: 'room',
			room,
		});

		if (selectorResult !== 'ok')
			return selectorResult;

		// Must be allowed to join room based on character restrictions (ask shard)
		Assert(this._assignedShard != null && this._assignedShard === room.assignedShard);
		const restrictionResult = await room.assignedShard.shardConnection?.awaitResponse('roomCheckCanEnter', {
			character: this.id,
			room: room.id,
		}).catch(() => undefined);
		// Check if the query was successful
		if (restrictionResult == null)
			return 'failed';
		Assert(restrictionResult.result !== 'targetNotFound');
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

		await room.addCharacter(this, sendEnterMessage);

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async leaveRoom(): Promise<'ok' | 'failed' | 'restricted'> {
		// Must be in a room (otherwise success)
		if (this.room == null)
			return 'ok';

		// Must be allowed to leave room based on character restrictions (ask shard)
		const restrictionResult = await this.room.assignedShard?.shardConnection?.awaitResponse('roomCheckCanLeave', {
			character: this.id,
		}).catch(() => undefined);
		// Check if the query was successful
		if (restrictionResult == null)
			return 'failed';
		Assert(restrictionResult.result !== 'targetNotFound');
		if (restrictionResult.result === 'ok') {
			// NOOP (fallthough)
		} else if (restrictionResult.result === 'restricted') {
			return 'restricted';
		} else {
			AssertNever(restrictionResult.result);
		}

		await this.room.removeCharacter(this, 'leave', this);

		const selector: CharacterShardSelector | null = this._assignedShard ? {
			type: 'shard',
			shard: this._assignedShard,
		} : null;

		await this._setShardSelector(selector);

		return 'ok';
	}
}
