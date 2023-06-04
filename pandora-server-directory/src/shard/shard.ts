import { IConnectionShard } from '../networking/common';
import { IDirectoryShardInfo, IShardDirectoryArgument, CharacterId, GetLogger, Logger, IShardCharacterDefinition, IDirectoryShardUpdate, RoomId, IChatRoomMessageDirectoryAction, IShardDirectoryPromiseResult, Assert, IShardChatRoomDefinition, AsyncSynchronized, ManuallyResolvedPromise, CreateManuallyResolvedPromise, IShardTokenType, AccountId } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { ShardManager, SHARD_TIMEOUT } from './shardManager';
import { Character } from '../account/character';
import type { Room } from '../room/room';
import { RoomManager } from '../room/roomManager';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Sleep } from '../utility';
import type { Account } from '../account/account';
import { isEqual, last, uniq } from 'lodash';
import type { IConnectedTokenInfo } from './shardTokenStore';

export class Shard {
	public readonly id;
	public readonly type: IShardTokenType;
	public shardConnection: IConnectionShard | null = null;
	private timeout: NodeJS.Timeout | null = null;

	private _registered: boolean = false;
	public get registered(): boolean {
		return this._registered;
	}
	private stopping: boolean = false;
	private reconnecting: boolean = false;

	private publicURL = '';
	private features: IDirectoryShardInfo['features'] = [];
	private version = '';

	private logger: Logger;

	constructor({ id, type }: Readonly<IConnectedTokenInfo>) {
		this.id = id;
		this.type = type;
		this.logger = GetLogger('Shard', `[Shard ${this.id}]`);
	}

	public allowConnect(): boolean {
		return this.registered && !this.stopping;
	}

	/** Map of character ids to characters */
	public readonly characters: Map<CharacterId, Character> = new Map();

	/** Map of room ids to rooms */
	public readonly rooms: Map<RoomId, Room> = new Map();

	public getConnectedCharacter(id: CharacterId): Character | undefined {
		return this.characters.get(id);
	}

	public getConnectedRoom(id: RoomId): Room | undefined {
		return this.rooms.get(id);
	}

	public async handleReconnect(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		// Invalidate current connection (when shard reconnects quicker than old connection times out)
		if (this.shardConnection) {
			this.setConnection(null);
		}

		this.reconnecting = true;

		Assert(this.publicURL === data.publicURL, `Shard's publicURL cannot change`);
		Assert(isEqual(this.features, data.features), `Shard's features cannot change`);
		Assert(this.version === data.version, `Shard's version cannot change`);

		// Characters and rooms from shard are ignored, Directory is source of truth on reconnect

		// Remove characters that should be connected but are not anymore
		await Promise.all(
			data.disconnectCharacters.map((id) => this.getConnectedCharacter(id)?.disconnect()),
		);

		this.setConnection(connection);
		this.logger.info('Reconnected');
		ConnectionManagerClient.onShardListChange();

		// If anyone is waiting for update, resolve it after sending data back
		if (this.updatePending != null) {
			const update = this.updatePending;
			this.updatePending = null;
			this.updateReasons.clear();
			setTimeout(() => {
				update.resolve();
			}, 100);
		}

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			rooms: this.makeRoomSetupList(),
			messages: this.makeDirectoryActionMessages(),
			blocks: this.makeAccountBlockDictionary(),
		};
	}

	public async register(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (this._registered) {
			throw new Error('Cannot re-register shard');
		}

		this.reconnecting = true;

		this.publicURL = data.publicURL;
		this.features = data.features;
		this.version = data.version;

		const accounts = new Map<number, Account>();
		await Promise.all(
			uniq(data.characters.map((c) => c.account.id))
				.map((id) => accountManager
					.loadAccountById(id)
					.then((account) => {
						if (account) {
							accounts.set(account.data.id, account);
						}
					}),
				),
		);

		// We should have no requests for the shard before it registered
		Assert(this.updatePending == null);

		this._registered = true;

		// Room ids should be unique in received data
		Assert(uniq(data.rooms.map((r) => r.id)).length === data.rooms.length);

		await Promise.all(
			data.rooms.map((roomData) => RoomManager
				.loadRoom(roomData.id)
				.then((room) => {
					return room?.shardReconnect(this, roomData.accessId);
				}),
			),
		);

		for (const characterData of data.characters) {
			// Skip characters that should be disconnected anyway
			if (data.disconnectCharacters.includes(characterData.id))
				continue;
			const account = accounts.get(characterData.account.id);
			const character = account?.characters.get(characterData.id);

			if (!character) {
				// Do not load in character that loaded elsewhere meanwhile
				continue;
			}

			const room = characterData.room ? this.rooms.get(characterData.room) : undefined;

			await character.shardReconnect({
				shard: this,
				accessId: characterData.accessId,
				connectionSecret: characterData.connectSecret,
				room,
			});

			this.logger.debug('Added character during registration', character.id);
		}

		for (const room of this.rooms.values()) {
			await room.cleanupIfEmpty();
		}

		this.setConnection(connection);
		this.logger.info('Registered');
		ConnectionManagerClient.onShardListChange();

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			rooms: this.makeRoomSetupList(),
			messages: this.makeDirectoryActionMessages(),
			blocks: this.makeAccountBlockDictionary(),
		};
	}

	public setConnection(connection: IConnectionShard | null): void {
		this.reconnecting = false;
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (this.shardConnection && this.shardConnection !== connection) {
			// TODO
			// this.shardConnection.disconnect();
			this.shardConnection.shard = null;
			this.shardConnection = null;
		}
		if (connection) {
			connection.shard = this;
			this.shardConnection = connection;
		} else {
			// Do not trigger timeout if we are already stopping
			if (!this.stopping) {
				this.timeout = setTimeout(this.handleTimeout.bind(this), SHARD_TIMEOUT);
			}
		}
	}

	private handleTimeout(): void {
		this.logger.info('Timed out');
		this.stopping = true;
		ConnectionManagerClient.onShardListChange();
		ShardManager.deleteShard(this.id)
			.catch((err) => {
				this.logger.fatal('Failed to delete timed-out shard', err);
			});
	}

	public async stop(): Promise<void> {
		this.logger.info('Stop issued');
		this.stopping = true;
		ConnectionManagerClient.onShardListChange();
		if (this.shardConnection) {
			await this.shardConnection.awaitResponse('stop', {});
		}
		await ShardManager.deleteShard(this.id);
	}

	public async onDelete(attemptReassign: boolean): Promise<void> {
		this.stopping = true;
		this.setConnection(null);

		// Force-reject any pending updates that were scheduled before shard's stop
		if (this.updatePending) {
			const update = this.updatePending;
			this.updatePending = null;
			update.reject('Shard deleted');
		}

		// Development shards wait for another shard to be present before reassign (for up to 60 seconds)
		if (attemptReassign && this.features.includes('development')) {
			const end = Date.now() + 60_000;
			while (Date.now() < end && ShardManager.listShads().length === 0 && !ShardManager.stopping) {
				this.logger.verbose('Waiting for another shard before migrating...');
				await Sleep(5_000);
			}
		}

		// Reassign rooms
		await Promise.all(
			[...this.rooms.values()]
				.map(async (room) => {
					await room.disconnect();
					if (attemptReassign) {
						await room.connect();
					}
				}),
		);
		// Reassign characters
		await Promise.all(
			[...this.characters.values()]
				.map(async (character) => {
					await character.setShard(null);
					if (attemptReassign) {
						await character.autoconnect();
						character.assignedConnection?.sendConnectionStateUpdate();
					}
				}),
		);
		this.logger.info('Deleted');
	}

	public getInfo(): IDirectoryShardInfo {
		return ({
			id: this.id,
			publicURL: this.publicURL,
			features: this.features,
			version: this.version,
		});
	}

	private updateReasons = new Set<keyof IDirectoryShardUpdate>();
	private updatePending: ManuallyResolvedPromise<void> | null = null;

	public update(...reasons: (keyof IDirectoryShardUpdate)[]): Promise<void> {
		Assert(this._registered);
		if (this.stopping)
			return Promise.resolve();

		reasons.forEach((r) => this.updateReasons.add(r));
		if (this.updatePending == null) {
			const update = this.updatePending = CreateManuallyResolvedPromise();
			setTimeout(() => {
				this._sendUpdate()
					.then((result) => {
						if (result && this.updatePending === update) {
							this.updatePending = null;
							update.resolve();
						}
					}, (error) => {
						this.logger.fatal('Error while running sendUpdate:', error);
					});
			}, 100);
		}

		return this.updatePending.promise;
	}

	@AsyncSynchronized()
	private async _sendUpdate(): Promise<boolean> {
		if (this.stopping || this.reconnecting || this.updateReasons.size === 0)
			return true;
		if (!this.shardConnection)
			return false;

		const update: Partial<IDirectoryShardUpdate> = {};
		const updateReasons = Array.from(this.updateReasons);
		this.updateReasons.clear();

		if (updateReasons.includes('characters')) {
			update.characters = this.makeCharacterSetupList();
		}
		if (updateReasons.includes('rooms')) {
			update.rooms = this.makeRoomSetupList();
		}
		if (updateReasons.includes('messages')) {
			update.messages = this.makeDirectoryActionMessages();
		}
		if (updateReasons.includes('blocks')) {
			update.blocks = this.makeAccountBlockDictionary();
		}

		try {
			await this.shardConnection.awaitResponse('update', update, 10_000);
			// Cleanup pending messages
			if (update.messages) {
				for (const room of this.rooms.values()) {
					if (!update.messages[room.id])
						continue;
					const lastMessage = last(update.messages[room.id]);
					if (lastMessage !== undefined) {
						const index = room.pendingMessages.indexOf(lastMessage);
						if (index >= 0) {
							room.pendingMessages.splice(0, index + 1);
						}
					}
				}
			}
		} catch (error) {
			this.logger.warning('Failed to update shard:', error);
			updateReasons.forEach((r) => this.updateReasons.add(r));
			return false;
		}
		return true;
	}

	@AsyncSynchronized()
	public async sendAccountBlockChanged(account: Account, blocked: AccountId[]) {
		if (this.stopping || this.reconnecting)
			return;
		if (!this.shardConnection)
			return;

		try {
			await this.shardConnection.awaitResponse('accountBlockChanged', {
				account: account.id,
				blocked,
			});
		} catch (error) {
			this.logger.warning('Failed to send account block changed:', error);
		}
	}

	private makeCharacterSetupList(): IShardCharacterDefinition[] {
		const result: IShardCharacterDefinition[] = [];
		for (const [id, character] of this.characters) {
			result.push({
				id,
				account: character.account.getShardAccountDefinition(),
				accessId: character.accessId,
				connectSecret: character.connectSecret,
				room: character.room ? character.room.id : null,
			});
		}
		return result;
	}

	private makeRoomSetupList(): IShardChatRoomDefinition[] {
		return Array.from(this.rooms.values()).map((r) => ({
			id: r.id,
			accessId: r.accessId,
			config: r.getConfig(),
			owners: Array.from(r.owners),
		}));
	}

	private makeDirectoryActionMessages(): Record<RoomId, IChatRoomMessageDirectoryAction[]> {
		const result: Record<RoomId, IChatRoomMessageDirectoryAction[]> = {};
		for (const room of this.rooms.values()) {
			if (room.pendingMessages.length > 0) {
				result[room.id] = room.pendingMessages.slice();
			}
		}
		return result;
	}

	private makeAccountBlockDictionary(): [AccountId, AccountId[]][] {
		const result: [AccountId, AccountId[]][] = [];
		const visited = new Set<AccountId>();
		for (const character of this.characters.values()) {
			if (visited.has(character.account.id))
				continue;

			visited.add(character.account.id);
			result.push([character.account.id, character.account.relationship.getBlocked()]);
		}
		return result;
	}
}
