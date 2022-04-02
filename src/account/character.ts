import { CharacterId, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { GetDatabase, ICharacterSelfInfoDb } from '../database/databaseProvider';
import { Account } from './account';
import { Shard } from '../shard/shard';
import { nanoid } from 'nanoid';
import { ShardManager } from '../shard/shardManager';
import { IConnectionClient } from '../networking/common';

export class Character {
	public readonly id: CharacterId;
	public readonly account: Account;

	public accessId: string = '';
	public connectSecret: string;

	public get accountCharacterIndex(): number {
		const result = this.account.data.characters.findIndex((c) => c.id === this.id);
		if (result < 0) {
			throw new Error(`Character index not found for ${this.id}`);
		}
		return result;
	}

	public assignedShard: Shard | null = null;

	public assignedConnection: IConnectionClient | null = null;

	constructor(characterData: ICharacterSelfInfoDb, account: Account) {
		this.id = characterData.id;
		this.account = account;
		if (!account.data.characters.some((c) => c.id === this.id)) {
			throw new Error('Mismatch in character and account');
		}
		this.connectSecret = this.generateConnectSecret();
	}

	public isInUse(): this is { assignedShard: Shard; } {
		return this.assignedShard != null;
	}

	public disconnect(): void {
		this.account.touch();
		if (!this.isInUse())
			return;
		this.assignedShard.disconnectCharacter(this.id);
	}

	public async generateAccessId(): Promise<string | null> {
		this.account.touch();
		const result = await GetDatabase().setCharacterAccess(this.id);
		if (result != null) {
			this.accessId = result;
		}
		return result;
	}

	public generateConnectSecret(): string {
		this.account.touch();
		return this.connectSecret = nanoid(8);
	}

	public async connectToShard({
		shard,
	}: {
		shard?: Shard;
	} = {}): Promise<'noShardFound' | 'failed' | IDirectoryCharacterConnectionInfo> {
		this.account.touch();
		if (this.isInUse()) {
			this.disconnect();
		}

		// Generate new access id for new shard
		const accessId = await this.generateAccessId();
		if (accessId == null)
			return 'failed';

		// Choose new shard if not defined
		if (!shard) {
			shard = ShardManager.getRandomShard() ?? undefined;
		}
		if (!shard)
			return 'noShardFound';

		return {
			...shard.getInfo(),
			characterId: this.id,
			secret: shard.connectCharacter(this),
		};
	}
}
