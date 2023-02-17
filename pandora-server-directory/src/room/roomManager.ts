import { AccountId, Assert, AsyncSynchronized, GetLogger, IChatRoomDirectoryConfig, IChatRoomDirectoryData, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from '../room/room';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider';
import { accountManager } from '../account/accountManager';

const logger = GetLogger('RoomManager');

const roomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms',
	help: 'Current count of rooms',
});

// To use decorators the class needs to be created normally; see https://github.com/microsoft/TypeScript/issues/7342
/** Class that stores all currently or recently used rooms, removing them when needed */
class RoomManagerClass {
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

	@AsyncSynchronized()
	public async createRoom(config: IChatRoomDirectoryConfig, owners: AccountId[]): Promise<Room | 'failed' | 'roomOwnershipLimitReached'> {
		Assert(owners.length > 0, 'Room must be created with some owners');

		// Check, that owners are within limits
		for (const ownerId of owners) {
			// Meta-account Pandora has no limit
			if (ownerId === 0)
				continue;

			const owner = await accountManager.loadAccountById(ownerId);
			// We cannot have unknown owner on creation
			if (!owner)
				return 'failed';

			const ownedRooms = await GetDatabase().getChatRoomsWithOwner(ownerId);

			if (ownedRooms.length + 1 > owner.roomOwnershipLimit)
				return 'roomOwnershipLimitReached';
		}

		const roomData = await GetDatabase().createChatRoom({
			config,
			owners,
		});
		logger.verbose(`Created room ${roomData.id}, owned by ${roomData.owners.join(',')}`);
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
		logger.verbose(`Destroyed room ${room.id}`);

		ConnectionManagerClient.onRoomListChange();
	}

	/** Create room from received data, adding it to loaded rooms */
	private loadRoom({ id, config, owners }: IChatRoomDirectoryData): Room {
		const room = new Room(id, config, owners);
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
}

export const RoomManager = new RoomManagerClass();
