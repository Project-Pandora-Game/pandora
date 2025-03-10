import { Assert, IDirectoryShardInfo, IShardTokenType } from 'pandora-common';
import promClient from 'prom-client';
import { Shard } from './shard.ts';
import { IConnectedTokenInfo } from './shardTokenStore.ts';

/** Time (in ms) after which manager prunes account without any active connection */
export const SHARD_TIMEOUT = 10_000;

export const SHARD_WAIT_STOP = Date.now() + SHARD_TIMEOUT;

const shardsMetric = new promClient.Gauge({
	name: 'pandora_directory_shards',
	help: 'Current count of shards',
});

export const ShardManager = new class ShardManager {
	private readonly shards: Map<string, Shard> = new Map();
	private _stopping: boolean = false;

	public get stopping(): boolean {
		return this._stopping;
	}

	public async deleteShard(id: string): Promise<void> {
		const shard = this.shards.get(id);
		if (!shard)
			return;
		this.shards.delete(id);
		shardsMetric.set(this.shards.size);
		await shard.onDelete(true);
	}

	public getOrCreateShard(info: Readonly<IConnectedTokenInfo>): Shard {
		let shard = this.shards.get(info.id);
		if (!shard) {
			shard = new Shard(info);
			this.shards.set(shard.id, shard);
			shardsMetric.set(this.shards.size);
		}
		Assert(shard.type === info.type, 'Shard type mismatch');
		return shard;
	}

	public listShads(): IDirectoryShardInfo[] {
		const result: IDirectoryShardInfo[] = [];
		for (const shard of this.shards.values()) {
			if (!IsVisible(shard, 'stable'))
				continue;
			result.push(shard.getInfo());
		}
		return result;
	}

	public getShard(id: string): Shard | null {
		return this.shards.get(id) || null;
	}

	public getRandomShard(): Shard | null {
		const shards = [...this.shards.values()].filter((s) => IsVisible(s, 'stable'));
		if (shards.length === 0)
			return null;

		return shards[Math.floor(Math.random() * shards.length)];
	}

	/**
	 * When server is stopping, drop all shards
	 */
	public async onDestroy(): Promise<void> {
		this._stopping = true;
		const shards = [...this.shards.values()];
		this.shards.clear();
		shardsMetric.set(this.shards.size);
		await Promise.all(shards.map((s) => s.onDelete(false)));
	}
};

function IsVisible(shard: Shard, ...allowedTypes: IShardTokenType[]): boolean {
	if (!shard.allowConnect())
		return false;

	return allowedTypes.includes(shard.type);
}
