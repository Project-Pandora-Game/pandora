import { Shard } from './shard';

/** Time (in ms) after which manager prunes account without any active connection */
export const SHARD_TIMEOUT = 10_000;

export const ShardManager = new class ShardManager {
	private readonly shards: Map<string, Shard> = new Map();

	public deleteShard(id: string): void {
		const shard = this.shards.get(id);
		if (!shard)
			return;
		this.shards.delete(id);
		shard.onDelete();
	}

	public getOrCreateShard(id: string | null): Shard {
		let shard = id && this.shards.get(id);
		if (!shard) {
			shard = new Shard();
			this.shards.set(shard.id, shard);
		}
		return shard;
	}

	public getShard(id: string): Shard | null {
		return this.shards.get(id) || null;
	}

	public getRandomShard(): Shard | null {
		if (this.shards.size === 0)
			return null;

		const shards = [...this.shards.values()];
		return shards[Math.floor(Math.random() * shards.length)];
	}
};
