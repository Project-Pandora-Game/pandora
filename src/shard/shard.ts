import { nanoid } from 'nanoid';
import { IConnectionShard } from '../networking/common';
import { IDirectoryShardInfo, IShardDirectoryArgument, CharacterId, GetLogger, Logger, IShardDirectoryNormalResult, IShardCharacterDefinition, IShardDirectoryPromiseResult } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { ShardManager, SHARD_TIMEOUT } from './shardManager';
import { Character } from '../account/character';

export class Shard {
	public readonly id = nanoid();
	public shardConnection: IConnectionShard | null = null;
	private timeout: NodeJS.Timeout | null = null;

	private _registered: boolean = false;
	public get registered(): boolean {
		return this._registered;
	}

	private publicURL = '';
	private features: IDirectoryShardInfo['features'] = [];
	private version = '';

	private logger: Logger;

	constructor() {
		this.logger = GetLogger('Shard', `[Shard ${this.id}]`);
	}

	/** Map of character ids to account id */
	readonly characters: Map<CharacterId, Character> = new Map();

	public handleReconnect(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryNormalResult['shardRegister'] {
		// Invalidate current connection (when shard reconnects quicker than old connection times out)
		if (this.shardConnection) {
			this.setConnection(null);
		}

		this.updateInfo(data);

		// Characters from shard are ignored, Directory is source of truth on reconnect

		// Remove characters that should be connected but are not anymore
		for (const id of this.characters.keys()) {
			if (!data.characters.some((c) => c.id === id)) {
				this.disconnectCharacter(id, false);
			}
		}

		this.setConnection(connection);
		this.logger.info('Reconnected');

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
		};
	}

	public async register(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (this._registered) {
			throw new Error('Cannot re-register shard');
		}

		this.updateInfo(data);
		this.setConnection(connection);

		for (const characterData of data.characters) {
			const account = await accountManager.loadAccountById(characterData.account);
			const character = account?.characters.get(characterData.id);

			if (!character ||
				character.isInUse() ||
				(character.accessId && character.accessId !== characterData.accessId)
			) {
				this.disconnectCharacter(characterData.id, false);
				continue;
			}

			character.assignedShard = this;
			character.accessId = characterData.accessId;
			character.connectSecret = characterData.connectSecret;
			this.characters.set(character.id, character);

			this.logger.debug('Added character during registration', character.id);
		}

		this._registered = true;

		this.logger.info('Registered');

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
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
		} else {
			this.timeout = setTimeout(this.handleTimeout.bind(this), SHARD_TIMEOUT);
		}
	}

	private handleTimeout(): void {
		ShardManager.deleteShard(this.id);
	}

	public onDelete(): void {
		[...this.characters.values()].forEach((character) => {
			this.disconnectCharacter(character.id, false);
			character.connectToShard().then(() => {
				character.assignedConnection?.sendConnectionStateUpdate();
			}, (err) => {
				this.logger.fatal('Error reconnecting character to different shard', err);
			});
		});
		this.updateCharacterList();
		if (this.shardConnection) {
			// TODO
			// this.shardConnection.disconnect();
			this.shardConnection.shard = null;
			this.shardConnection = null;
		}
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

	public connectCharacter(character: Character): string {
		if (character.assignedShard !== null) {
			throw new Error('Character already in use');
		}

		character.assignedShard = this;
		const secret = character.generateConnectSecret();

		this.characters.set(character.id, character);
		this.updateCharacterList();

		this.logger.debug('Connected character', character.id);

		return secret;
	}

	/**
	 * Disconnects an character from the shard
	 * @param id - Id of the character to disconnect
	 * @param push - If changes should be pushed to the shard
	 */
	public disconnectCharacter(id: CharacterId, push: boolean = true): void {
		const character = this.characters.get(id);
		if (!character)
			return;

		this.characters.delete(id);
		if (push) {
			this.updateCharacterList();
		}

		if (character.assignedShard === this) {
			character.assignedShard = null;
		}

		this.logger.debug('Disconnected character', character.id);
	}

	private updateCharacterList(): void {
		if (!this.shardConnection)
			return;

		this.shardConnection.sendMessage('prepareCharacters', {
			characters: this.makeCharacterSetupList(),
		});
	}

	private makeCharacterSetupList(): IShardCharacterDefinition[] {
		const result: IShardCharacterDefinition[] = [];
		for (const [id, character] of this.characters) {
			result.push({
				id,
				account: character.account.data.id,
				accessId: character.accessId,
				connectSecret: character.connectSecret,
			});
		}
		return result;
	}
}
