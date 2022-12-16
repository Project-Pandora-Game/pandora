import type { CharacterId, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import type { Account } from './account';
import type { Shard } from '../shard/shard';
import type { Room } from '../shard/room';
import type { IConnectionClient } from '../networking/common';
import { GetDatabase, ICharacterSelfInfoDb } from '../database/databaseProvider';
import { nanoid } from 'nanoid';
import { ShardManager } from '../shard/shardManager';

export class Character {
	public readonly id: CharacterId;
	public readonly account: Account;
	public readonly data: Readonly<ICharacterSelfInfoDb>;

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

	public room: Room | null = null;

	constructor(characterData: ICharacterSelfInfoDb, account: Account) {
		this.id = characterData.id;
		this.account = account;
		this.data = characterData;
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
		this.room?.removeCharacter(this, 'disconnect');
		this.assignedShard?.disconnectCharacter(this.id);
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

	public getShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
		if (!this.assignedShard)
			return null;
		return {
			...this.assignedShard.getInfo(),
			characterId: this.id,
			secret: this.connectSecret,
		};
	}

	private getShardConnectionInfoAssert(): IDirectoryCharacterConnectionInfo {
		const info = this.getShardConnectionInfo();
		if (!info) {
			throw new Error('No shard connection info when expected');
		}
		return info;
	}

	public async connect(): Promise<'noShardFound' | 'failed' | IDirectoryCharacterConnectionInfo> {
		if (this.room) {
			return this.connectToShard({ room: this.room });
		}

		let shard: Shard | null = this.assignedShard;
		if (!shard) {
			shard = ShardManager.getRandomShard();
		}
		// If there is still no shard found, then we disconnect
		if (!shard) {
			this.disconnect();
			return 'noShardFound';
		}
		return this.connectToShard({ shard });
	}

	public async connectToShard(args: {
		room: Room;
		sendEnterMessage?: false;
		refreshSecret?: boolean;
	}): Promise<'failed' | IDirectoryCharacterConnectionInfo>;
	public async connectToShard(args: {
		shard: Shard;
		refreshSecret?: boolean;
	}): Promise<'failed' | IDirectoryCharacterConnectionInfo>;
	public async connectToShard({
		shard,
		room,
		sendEnterMessage,
		refreshSecret = true,
	}: {
		shard?: Shard;
		room?: Room;
		sendEnterMessage?: false;
		refreshSecret?: boolean;
	}): Promise<'failed' | IDirectoryCharacterConnectionInfo> {
		this.account.touch();

		if (room) {
			// If in a room, the room always chooses shard
			shard = room.shard;
		} else if (!shard) {
			throw new Error('Neither room nor shard passed');
		}

		// If we were in a wrong room, we leave it
		if (this.room && this.room !== room) {
			this.room.removeCharacter(this, 'leave');
		}

		// If we are on a wrong shard, we leave it
		if (this.assignedShard !== shard) {
			this.assignedShard?.disconnectCharacter(this.id);
			// Generate new access id for new shard
			const accessId = await this.generateAccessId();
			if (accessId == null)
				return 'failed';
		}

		// Check that we can actually join the shard (prevent race condition on shard shutdown)
		if (!shard.allowConnect()) {
			return 'failed';
		}

		if (this.assignedShard !== shard || refreshSecret) {
			shard.connectCharacter(this);
		}

		if (room) {
			room.addCharacter(this, sendEnterMessage !== false);
		}

		return this.getShardConnectionInfoAssert();
	}
}
