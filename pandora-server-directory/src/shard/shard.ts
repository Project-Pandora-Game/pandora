import { IConnectionShard } from '../networking/common';
import { IDirectoryShardInfo, IShardDirectoryArgument, CharacterId, GetLogger, Logger, IShardDirectoryNormalResult, IShardCharacterDefinition, IShardDirectoryPromiseResult, IChatRoomFullInfo, AssertNever, IDirectoryShardUpdate, RoomId, IChatRoomMessageDirectoryAction } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { ShardManager, SHARD_TIMEOUT } from './shardManager';
import { Character } from '../account/character';
import type { Room } from './room';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Sleep } from '../utility';
import type { Account } from '../account/account';
import { last, uniq } from 'lodash';

export class Shard {
	public readonly id;
	public shardConnection: IConnectionShard | null = null;
	private timeout: NodeJS.Timeout | null = null;

	private _registered: boolean = false;
	public get registered(): boolean {
		return this._registered;
	}
	private stopping: boolean = false;

	private publicURL = '';
	private features: IDirectoryShardInfo['features'] = [];
	private version = '';

	private logger: Logger;

	public rooms: Set<Room> = new Set();

	constructor(id: string) {
		this.id = id;
		this.logger = GetLogger('Shard', `[Shard ${this.id}]`);
	}

	public allowConnect(): boolean {
		return this.registered && !this.stopping;
	}

	/** Map of character ids to account id */
	private readonly characters: Map<CharacterId, Character> = new Map();

	public getConnectedCharacter(id: CharacterId): Character | undefined {
		return this.characters.get(id);
	}

	public handleReconnect(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryNormalResult['shardRegister'] {
		// Invalidate current connection (when shard reconnects quicker than old connection times out)
		if (this.shardConnection) {
			this.setConnection(null);
		}

		this.updateInfo(data);

		// Characters and rooms from shard are ignored, Directory is source of truth on reconnect

		// Remove characters that should be connected but are not anymore
		for (const id of data.disconnectCharacters) {
			this.disconnectCharacter(id);
		}

		this.setConnection(connection);
		this.logger.info('Reconnected');
		ConnectionManagerClient.onShardListChange();

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			rooms: this.makeRoomSetupList(),
			messages: this.makeDirectoryActionMessages(),
		};
	}

	public async register(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (this._registered) {
			throw new Error('Cannot re-register shard');
		}

		this.updateInfo(data);

		const accounts = new Map<number, Account>();
		await Promise.all(
			uniq(data.characters.map((c) => c.account))
				.map((id) => accountManager
					.loadAccountById(id)
					.then((account) => {
						if (account) {
							accounts.set(account.data.id, account);
						}
					}),
				),
		);

		this._registered = true;

		for (const roomData of data.rooms) {
			ShardManager.createRoom(roomData, this, roomData.id);
		}

		for (const characterData of data.characters) {
			// Skip characters that should be disconnected anyway
			if (data.disconnectCharacters.includes(characterData.id))
				continue;
			const account = accounts.get(characterData.account);
			const character = account?.characters.get(characterData.id);

			if (!character ||
				character.isInUse() ||
				(character.accessId && character.accessId !== characterData.accessId)
			) {
				// Do not load in character that loaded elsewhere meanwhile
				continue;
			}

			const room = characterData.room ? ShardManager.getRoom(characterData.room) : undefined;

			character.accessId = characterData.accessId;
			this.connectCharacter(character, characterData.connectSecret);
			room?.addCharacter(character, false);

			character.assignedConnection?.sendConnectionStateUpdate();
			character.account.onCharacterListChange();

			this.logger.debug('Added character during registration', character.id);
		}

		for (const room of this.rooms.values()) {
			room.cleanupIfEmpty();
		}

		this.setConnection(connection);
		this.logger.info('Registered');
		ConnectionManagerClient.onShardListChange();

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			rooms: this.makeRoomSetupList(),
			messages: this.makeDirectoryActionMessages(),
		};
	}

	public setConnection(connection: IConnectionShard | null): void {
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
		} else if (!this.stopping) {
			// Do not trigger timeout if we are already stopping
			this.timeout = setTimeout(this.handleTimeout.bind(this), SHARD_TIMEOUT);
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout);
				this.updateTimeout = null;
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

		// Development shards wait for another shard to be present before reassign (for up to 60 seconds)
		if (attemptReassign && this.features.includes('development')) {
			const end = Date.now() + 60_000;
			while (Date.now() < end && ShardManager.listShads().length === 0 && !ShardManager.stopping) {
				this.logger.verbose('Waiting for another shard before migrating...');
				await Sleep(5_000);
			}
		}

		if (attemptReassign) {
			await Promise.all(
				[...this.rooms.values()]
					.map(async (room) => {
						await ShardManager
							.migrateRoom(room)
							.catch((error) => {
								this.logger.warning('Room migration failed', error);
							});
					}),
			);
		}
		await Promise.all(
			[...this.characters.values()]
				.map(async (character) => {
					this.disconnectCharacter(character.id);
					if (attemptReassign) {
						await character.connect();
						character.assignedConnection?.sendConnectionStateUpdate();
					}
				}),
		);
		this.logger.info('Deleted');
	}

	public updateInfo(info: IShardDirectoryArgument['shardRegister']): void {
		this.publicURL = info.publicURL;
		this.features = info.features;
		this.version = info.version;
	}

	public getInfo(): IDirectoryShardInfo {
		return ({
			id: this.id,
			publicURL: this.publicURL,
			features: this.features,
			version: this.version,
		});
	}

	public connectCharacter(character: Character, connectSecret?: string): void {
		if (character.assignedShard !== null && character.assignedShard !== this) {
			throw new Error('Character already in use');
		}
		if (!this.allowConnect()) {
			throw new Error('Connecting to this shard is not allowed');
		}

		this.characters.set(character.id, character);
		character.assignedShard = this;
		if (connectSecret) {
			character.connectSecret = connectSecret;
		} else {
			character.generateConnectSecret();
		}
		this.update('characters');

		character.account.onCharacterListChange();

		this.logger.debug('Connected character', character.id);
	}

	/**
	 * Disconnects an character from the shard
	 * @param id - Id of the character to disconnect
	 * @param push - If changes should be pushed to the shard
	 */
	public disconnectCharacter(id: CharacterId): void {
		const character = this.characters.get(id);
		if (!character)
			return;
		if (character.assignedShard !== this) {
			AssertNever();
		}

		if (character.room?.shard === this) {
			character.room.removeCharacter(character, 'disconnect');
		}

		this.characters.delete(id);
		character.assignedShard = null;
		this.update('characters');

		character.account.onCharacterListChange();

		this.logger.debug('Disconnected character', character.id);
	}

	private updateTimeout: NodeJS.Timeout | null = null;
	private updateReasons = new Set<keyof IDirectoryShardUpdate>();

	public update(...reasons: (keyof IDirectoryShardUpdate)[]): void {
		reasons.forEach((r) => this.updateReasons.add(r));
		if (!this.shardConnection || this.updateTimeout != null)
			return;

		this.updateTimeout = setTimeout(() => {
			this.updateTimeout = null;
			void this.sendUpdate();
		}, 100).unref();
	}

	private sendUpdate(): Promise<void> {
		if (this.stopping || !this.shardConnection || this.updateReasons.size === 0)
			return Promise.resolve();

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

		return this.shardConnection
			.awaitResponse('update', update, 10_000)
			.then(
				() => {
					// Cleanup pending messages
					if (update.messages) {
						for (const room of this.rooms) {
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
				},
				(err) => {
					this.logger.warning('Failed to update shard:', err);
					updateReasons.forEach((r) => this.updateReasons.add(r));
				},
			);
	}

	private makeCharacterSetupList(): IShardCharacterDefinition[] {
		const result: IShardCharacterDefinition[] = [];
		for (const [id, character] of this.characters) {
			result.push({
				id,
				account: character.account.id,
				accessId: character.accessId,
				connectSecret: character.connectSecret,
				room: character.room ? character.room.id : null,
			});
		}
		return result;
	}

	private makeRoomSetupList(): IChatRoomFullInfo[] {
		return Array.from(this.rooms.values()).map((r) => r.getFullInfo());
	}

	private makeDirectoryActionMessages(): Record<RoomId, IChatRoomMessageDirectoryAction[]> {
		const result: Record<RoomId, IChatRoomMessageDirectoryAction[]> = {};
		for (const room of this.rooms) {
			if (room.pendingMessages.length > 0) {
				result[room.id] = room.pendingMessages.slice();
			}
		}
		return result;
	}
}
