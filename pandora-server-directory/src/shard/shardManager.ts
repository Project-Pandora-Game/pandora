import { nanoid } from 'nanoid';
import { IDirectoryShardInfo } from 'pandora-common';
import { Shard } from './shard';
import promClient from 'prom-client';
import { IConnectedTokenInfo } from './shardTokenStore';

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

	public getOrCreateShard({ id  }:  Readonly<IConnectedTokenInfo>): Shard {
		let shard = id && this.shards.get(id);
		if (!shard) {
			shard = new Shard(id ?? nanoid());
			this.shards.set(shard.id, shard);
			shardsMetric.set(this.shards.size);
		}
		return shard;
	}

	public listShads(): IDirectoryShardInfo[] {
		const result: IDirectoryShardInfo[] = [];
		for (const shard of this.shards.values()) {
			if (!shard.allowConnect())
				continue;
			result.push(shard.getInfo());
		}
		return result;
	}

	public getShard(id: string): Shard | null {
		return this.shards.get(id) || null;
	}

	public getRandomShard(): Shard | null {
		const shards = [...this.shards.values()].filter((s) => s.allowConnect());
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
