import { GetLogger, IChatRoomDirectoryConfig, IChatRoomDirectoryData, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from '../room/room';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider';

const logger = GetLogger('RoomManager');

const roomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms',
	help: 'Current count of rooms',
});

/** Class that stores all currently or recently used rooms, removing them when needed */
export const RoomManager = new class RoomManager {
	private readonly rooms: Map<RoomId, Room> = new Map();

	/** Init the manager */
	public async init(): Promise<void> {
		// TEMPORARY: Load all the chatrooms from database into memory
		for (const room of await GetDatabase().getAllChatRoomsDirectory()) {
			this.loadRoom(room);
		}
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

	public async createRoom(config: IChatRoomDirectoryConfig): Promise<Room | 'nameTaken'> {
		if (this.getRoomByName(config.name))
			return 'nameTaken';

		const roomData = await GetDatabase().createChatRoom(config);
		const room = this.loadRoom(roomData);

		ConnectionManagerClient.onRoomListChange();

		return room;
	}

	/**
	 * Destroy a room
	 * @param room - The room to destroy
	 */
	public async destroyRoom(room: Room): Promise<void> {
		if (this.rooms.get(room.id) === room) {
			this.rooms.delete(room.id);
			roomsMetric.set(this.rooms.size);
		}
		room.onDestroy();
		await GetDatabase().deleteChatRoom(room.id);

		ConnectionManagerClient.onRoomListChange();
	}

	/** Create room from received data, adding it to loaded rooms */
	private loadRoom({ id, config }: IChatRoomDirectoryData): Room {
		const room = new Room(id, config);
		this.rooms.set(room.id, room);
		roomsMetric.set(this.rooms.size);
		logger.debug(`Loaded room ${room.id}`);
		return room;
	}

	/** Remove room from loaded rooms, running necessary cleanup actions */
	private unloadRoom(room: Room): void {
		logger.debug(`Unloading room ${room.id}`);
		if (this.rooms.get(room.id) === room) {
			this.rooms.delete(room.id);
			roomsMetric.set(this.rooms.size);
		}
	}
};
