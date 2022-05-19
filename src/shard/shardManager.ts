import { IChatRoomDirectoryConfig, IDirectoryShardInfo, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from './room';
import { Shard } from './shard';

/** Time (in ms) after which manager prunes account without any active connection */
export const SHARD_TIMEOUT = 10_000;

export const ShardManager = new class ShardManager {
	private readonly shards: Map<string, Shard> = new Map();
	private readonly rooms: Map<RoomId, Room> = new Map();

	public deleteShard(id: string): void {
		const shard = this.shards.get(id);
		if (!shard)
			return;
		this.shards.delete(id);
		shard.onDelete(true);
	}

	public getOrCreateShard(id: string | null): Shard {
		let shard = id && this.shards.get(id);
		if (!shard) {
			shard = new Shard();
			this.shards.set(shard.id, shard);
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

	public listRooms(): Room[] {
		return Array.from(this.rooms.values());
	}

	public getRoom(id: RoomId): Room | undefined {
		return this.rooms.get(id);
	}

	public getRoomByName(name: string): Room | undefined {
		name = name.toLowerCase();
		return Array.from(this.rooms.values()).find((r) => r.name.toLowerCase() === name);
	}

	public createRoom(config: IChatRoomDirectoryConfig, shard?: Shard, id?: RoomId): Room | 'nameTaken' | 'noShardFound' {
		if (id != null && this.rooms.has(id)) {
			throw new Error(`Attempt to create room while room with id already exists (${id})`);
		}

		if (this.getRoomByName(config.name))
			return 'nameTaken';

		if (!shard) {
			if (config.features.includes('development') && config?.development?.shardId) {
				shard = this.getShard(config.development.shardId) ?? undefined;
			} else {
				shard = this.getRandomShard() ?? undefined;
			}
		}

		if (!shard)
			return 'noShardFound';

		const room = new Room(config, shard, id);
		this.rooms.set(room.id, room);

		ConnectionManagerClient.onRoomListChange();

		return room;
	}

	/**
	 * Destroy a room
	 * @param room - The room to destroy
	 */
	public destroyRoom(room: Room): void {
		this.rooms.delete(room.id);
		room.onDestroy();

		ConnectionManagerClient.onRoomListChange();
	}

	/**
	 * When server is stopping, drop all shards
	 */
	public onDestroy(): void {
		const shards = [...this.shards.values()];
		this.shards.clear();
		for (const shard of shards) {
			shard.onDelete(false);
		}
	}
};
