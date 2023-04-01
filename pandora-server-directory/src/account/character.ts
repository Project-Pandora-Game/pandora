import { Assert, AssertNever, AssertNotNullable, AsyncSynchronized, CharacterId, GetLogger, IDirectoryCharacterConnectionInfo, Logger } from 'pandora-common';
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
	public readonly data: Readonly<ICharacterSelfInfoDb>;
	protected readonly logger: Logger;

	public accessId: string = '';
	public connectSecret: string;

	public get accountCharacterIndex(): number {
		const result = this.account.data.characters.findIndex((c) => c.id === this.id);
		if (result < 0) {
			throw new Error(`Character index not found for ${this.id}`);
		}
		return result;
	}

	/** Which client is assigned to this character and receives updates from it; only passive listener to what happens to the character */
	public assignedConnection: ClientConnection | null = null;

	/** Which room this character is in */
	public room: Room | null = null;

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
		this.data = characterData;
		if (!account.data.characters.some((c) => c.id === this.id)) {
			throw new Error('Mismatch in character and account');
		}
		this.connectSecret = GenerateConnectSecret();
	}

	public isInUse(): boolean {
		return this._assignedShard != null;
	}

	public async disconnect(): Promise<void> {
		this.account.touch();
		await this.room?.removeCharacter(this, 'disconnect', null);
		await this.setShard(null);
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
		this._assignedShard?.update('characters');
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
		connection.setCharacter(this);
		connection.sendConnectionStateUpdate();

		// If we are already on shard, simply update the shard's connection secret and we are done
		if (this._assignedShard) {
			this._assignedShard.update('characters');
			return 'ok';
		}

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

		await this._setShardSelector(selector, accessId);
		if (room) {
			await this.joinRoom(room, false);
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

		if (selector?.type === 'room') {
			// If we are in a room, the selector's room must match it
			if (this.room != null && selector.room !== this.room)
				return 'failed';

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
			Assert(this._assignedShard.getConnectedCharacter(this.id) === this);

			this._assignedShard.characters.delete(this.id);
			this._assignedShard.update('characters');

			this._assignedShard = null;

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
			shard.update('characters');

			this.logger.debug('Connected to shard', shard.id);
		}
		this.account.onCharacterListChange();
		this.assignedConnection?.sendConnectionStateUpdate();
	}

	@AsyncSynchronized('object')
	public async joinRoom(room: Room, sendEnterMessage: boolean): Promise<'failed' | 'ok'> {
		// Must not be in a different room (TODO: Shift the logic here)
		if (this.room != null)
			return 'failed';

		// Must already be tracking the correct room
		const selectorResult = await this._setShardSelector({
			type: 'room',
			room,
		});

		if (selectorResult !== 'ok')
			return selectorResult;

		room.addCharacter(this, sendEnterMessage);

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async leaveRoom(): Promise<'failed' | 'ok'> {
		// Must be in a room (otherwise success)
		if (this.room == null)
			return 'ok';

		await this.room.removeCharacter(this, 'leave', this);

		const selector: CharacterShardSelector | null = this._assignedShard ? {
			type: 'shard',
			shard: this._assignedShard,
		} : null;

		await this._setShardSelector(selector);

		return 'ok';
	}
}
