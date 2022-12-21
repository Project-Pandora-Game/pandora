import { nanoid } from 'nanoid';
import { IChatRoomDirectoryConfig, IDirectoryShardInfo, RoomId, Service } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from './room';
import { Shard } from './shard';
import { omit } from 'lodash';
import promClient from 'prom-client';

/** Time (in ms) after which manager prunes account without any active connection */
export const SHARD_TIMEOUT = 10_000;

export const SHARD_WAIT_STOP = Date.now() + SHARD_TIMEOUT;

const shardsMetric = new promClient.Gauge({
	name: 'pandora_directory_shards',
	help: 'Current count of shards',
});

const roomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms',
	help: 'Current count of rooms',
});

export const ShardManager = new class ShardManager implements Service {
	private readonly shards: Map<string, Shard> = new Map();
	private readonly rooms: Map<RoomId, Room> = new Map();
	private _stopping: boolean = false;

	public get stopping(): boolean {
		return this._stopping;
	}

	public init(): void {
		// Nothing to do
	}

	public async deleteShard(id: string): Promise<void> {
		const shard = this.shards.get(id);
		if (!shard)
			return;
		this.shards.delete(id);
		shardsMetric.set(this.shards.size);
		await shard.onDelete(true);
	}

	public getOrCreateShard(id: string | null): Shard {
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
		roomsMetric.set(this.rooms.size);

		ConnectionManagerClient.onRoomListChange();

		return room;
	}

	public async migrateRoom(room: Room): Promise<void> {
		const info = omit(room.getFullInfo(), 'id');

		if (this.rooms.get(room.id) === room) {
			this.rooms.delete(room.id);
			roomsMetric.set(this.rooms.size);
		}

		const newRoom = this.createRoom(info, undefined, room.id);
		if (typeof newRoom === 'string') {
			return Promise.reject(newRoom);
		}

		await room.migrateTo(newRoom);

		this.destroyRoom(room);
	}

	/**
	 * Destroy a room
	 * @param room - The room to destroy
	 */
	public destroyRoom(room: Room): void {
		if (this.rooms.get(room.id) === room) {
			this.rooms.delete(room.id);
			roomsMetric.set(this.rooms.size);
		}
		room.onDestroy();

		ConnectionManagerClient.onRoomListChange();
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
