import { IChatRoomDirectoryConfig, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from '../room/room';
import { Shard } from '../shard/shard';
import { omit } from 'lodash';
import promClient from 'prom-client';
import { ShardManager } from '../shard/shardManager';

const roomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms',
	help: 'Current count of rooms',
});

/** Class that stores all currently or recently used rooms, removing them when needed */
export const RoomManager = new class RoomManager {
	private readonly rooms: Map<RoomId, Room> = new Map();

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
				shard = ShardManager.getShard(config.development.shardId) ?? undefined;
			} else {
				shard = ShardManager.getRandomShard() ?? undefined;
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
};
