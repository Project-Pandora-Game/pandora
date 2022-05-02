import { nanoid } from 'nanoid';
import { IConnectionShard } from '../networking/common';
import { IDirectoryShardInfo, IShardDirectoryArgument, CharacterId, GetLogger, Logger, IShardDirectoryNormalResult, IShardCharacterDefinition, IShardDirectoryPromiseResult, IChatRoomFullInfo, AssertNever, IDirectoryShardArgument } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { ShardManager, SHARD_TIMEOUT } from './shardManager';
import { Character } from '../account/character';
import type { Room } from './room';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Sleep } from '../utility';

export class Shard {
	public readonly id = nanoid();
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

	constructor() {
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
			roomLeaveReasons: this.makeRoomLeaveReasons(),
		};
	}

	public async register(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (this._registered) {
			throw new Error('Cannot re-register shard');
		}

		this.updateInfo(data);

		for (const roomData of data.rooms) {
			ShardManager.createRoom(roomData, this, roomData.id);
		}

		for (const characterData of data.characters) {
			// Skip characters that should be disconnected anyway
			if (data.disconnectCharacters.includes(characterData.id))
				continue;
			const account = await accountManager.loadAccountById(characterData.account);
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
			room?.addCharacter(character);

			character.assignedConnection?.sendConnectionStateUpdate();
			character.account.onCharacterListChange();

			this.logger.debug('Added character during registration', character.id);
		}

		for (const room of this.rooms.values()) {
			room.cleanupIfEmpty();
		}

		this._registered = true;
		this.setConnection(connection);
		this.logger.info('Registered');
		ConnectionManagerClient.onShardListChange();

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			rooms: this.makeRoomSetupList(),
			roomLeaveReasons: this.makeRoomLeaveReasons(),
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
			if (this.characterListTimeout) {
				clearTimeout(this.characterListTimeout);
				this.characterListTimeout = null;
			}
		}
	}

	private handleTimeout(): void {
		ShardManager.deleteShard(this.id);
	}

	public async stop(): Promise<void> {
		this.logger.verbose('Stop issued');
		this.stopping = true;
		ConnectionManagerClient.onShardListChange();
		if (this.shardConnection) {
			await this.shardConnection.awaitResponse('stop', {});
		}
		if (this.features.includes('development')) {
			await Sleep(5_000);
		}
		ShardManager.deleteShard(this.id);
	}

	public onDelete(): void {
		this.stopping = true;
		this.setConnection(null);
		[...this.characters.values()].forEach((character) => {
			this.disconnectCharacter(character.id);
			character.connect().then(() => {
				character.assignedConnection?.sendConnectionStateUpdate();
			}, (err) => {
				this.logger.fatal('Error reconnecting character to different shard', err);
			});
		});
		this.logger.info('Deleted');
		ConnectionManagerClient.onShardListChange();
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
		this.updateCharacterList();

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
		this.updateCharacterList();

		character.account.onCharacterListChange();

		this.logger.debug('Disconnected character', character.id);
	}

	private characterListTimeout: NodeJS.Timeout | null = null;

	public updateCharacterList(): void {
		if (!this.shardConnection || this.characterListTimeout != null)
			return;

		this.characterListTimeout = setTimeout(() => {
			this.characterListTimeout = null;
			if (this.stopping)
				return;
			this.shardConnection?.sendMessage('prepareCharacters', {
				characters: this.makeCharacterSetupList(),
				rooms: this.makeRoomSetupList(),
				roomLeaveReasons: this.makeRoomLeaveReasons(),
			});
		}, 100).unref();
	}

	private makeCharacterSetupList(): IShardCharacterDefinition[] {
		const result: IShardCharacterDefinition[] = [];
		for (const [id, character] of this.characters) {
			result.push({
				id,
				account: character.account.data.id,
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

	private makeRoomLeaveReasons(): IDirectoryShardArgument['prepareCharacters']['roomLeaveReasons'] {
		const result: IDirectoryShardArgument['prepareCharacters']['roomLeaveReasons'] = {};
		for (const room of this.rooms) {
			result[room.id] = room.getAndClearLeaveReasons();
		}
		return result;
	}
}
