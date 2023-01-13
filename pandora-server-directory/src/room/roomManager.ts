import { Assert, IChatRoomDirectoryConfig, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from '../room/room';
import { Shard } from '../shard/shard';
import promClient from 'prom-client';
import { ShardManager } from '../shard/shardManager';
import { nanoid } from 'nanoid';

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
		if (id == null) {
			id = `r${nanoid()}`;
		}
		if (this.rooms.has(id)) {
			throw new Error(`Attempt to create room while room with id already exists (${id})`);
		}

		if (this.getRoomByName(config.name))
			return 'nameTaken';

		if (!shard && config.features.includes('development') && config?.development?.shardId) {
			shard = ShardManager.getShard(config.development.shardId) ?? undefined;
			if (!shard)
				return 'noShardFound';
		}

		const room = new Room({
			...config,
			id,
		});
		this.rooms.set(room.id, room);
		roomsMetric.set(this.rooms.size);

		if (shard) {
			const result = room.connectToShard({ shard });
			Assert(result === shard);
		}

		ConnectionManagerClient.onRoomListChange();

		return room;
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
