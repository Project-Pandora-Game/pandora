import { AccountId, Assert, AsyncSynchronized, GetLogger, IChatRoomDirectoryConfig, IChatRoomDirectoryData, RoomId } from 'pandora-common';
import { ConnectionManagerClient } from '../networking/manager_client';
import { Room } from '../room/room';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider';
import { accountManager } from '../account/accountManager';
import { Account } from '../account/account';

/** Time (in ms) after which manager prunes rooms without any activity (search or characters inside) */
export const ROOM_INACTIVITY_THRESHOLD = 60_000;
/** Time (in ms) of how often manager runs period checks */
export const TICK_INTERVAL = 15_000;

const logger = GetLogger('RoomManager');

// TODO
// const totalRoomsMetric = new promClient.Gauge({
//     name: 'pandora_directory_rooms',
//     help: 'Total count of rooms that exist',
// });

const loadedRoomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms_loaded',
	help: 'Current count of rooms loaded into memory',
});

const inUseRoomsMetric = new promClient.Gauge({
	name: 'pandora_directory_rooms_in_use',
	help: 'Current count of rooms in use',
});

/** Class that stores all currently or recently used rooms, removing them when needed */
export const RoomManager = new class RoomManagerClass {
	private readonly loadedRooms: Map<RoomId, Room> = new Map();

	/** Init the manager */
	public init(): void {
		if (this.interval === undefined) {
			this.interval = setInterval(this.tick.bind(this), TICK_INTERVAL).unref();
		}
	}

	public onDestroy(): void {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		// Go through rooms and remove all of them
		for (const room of Array.from(this.loadedRooms.values())) {
			this._unloadRoom(room);
		}
		inUseRoomsMetric.set(0);
	}

	/** A tick of the manager, happens every `ACCOUNTMANAGER_TICK_INTERVAL` ms */
	private tick(): void {
		const now = Date.now();
		let inUseRoomCount = 0;
		// Go through rooms and prune old, inactive ones ones
		for (const room of Array.from(this.loadedRooms.values())) {
			if (room.isInUse()) {
				inUseRoomCount++;
				room.touch();
			} else if (room.lastActivity + ROOM_INACTIVITY_THRESHOLD < now) {
				this._unloadRoom(room);
			}
		}
		inUseRoomsMetric.set(inUseRoomCount);
	}

	private interval: NodeJS.Timeout | undefined;

	public async listRoomsVisibleTo(account: Account): Promise<Room[]> {
		const result = new Set<Room>();
		// Look for publically visible, currently loaded rooms rooms
		for (const room of this.loadedRooms.values()) {
			if (room.checkVisibleTo(account)) {
				room.touch();
				result.add(room);
			}
		}
		// Look for owned rooms or rooms this account is admin of
		for (const roomData of await GetDatabase().getChatRoomsWithOwnerOrAdmin(account.id)) {
			// Load the room (using already loaded to avoid race conditions)
			const room = this.loadedRooms.get(roomData.id) ?? this._loadRoom(roomData);
			// If we are still owner or admin, add it to the list
			if (room.checkVisibleTo(account)) {
				result.add(room);
			}
		}
		return Array.from(result);
	}

	/** Returns a list of rooms currently in memory */
	public listLoadedRooms(): Room[] {
		return Array.from(this.loadedRooms.values());
	}

	/**
	 * Find a room between **currently loaded rooms**, returning `null` if not found
	 */
	public getLoadedRoom(id: RoomId): Room | null {
		const room = this.loadedRooms.get(id);
		room?.touch();
		return room ?? null;
	}

	/**
	 * Find a room between loaded ones or try to load it from database
	 * @returns The room or `null` if not found even in database
	 */
	public async loadRoom(id: RoomId): Promise<Room | null> {
		// Check if account is loaded and return it if it is
		let room = this.getLoadedRoom(id);
		if (room)
			return room;
		// Get it from database
		const data = await GetDatabase().getChatRoomById(id, null);
		// Check if we didn't load it while we were querying data from DB and use already loaded if we did
		room = this.getLoadedRoom(id);
		if (room)
			return room;
		// Use the acquired DB data to load room
		if (!data)
			return null;
		return this._loadRoom(data);
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
		const room = this._loadRoom(roomData);

		ConnectionManagerClient.onRoomListChange();

		return room;
	}

	/**
	 * Destroy a room
	 * @param room - The room to destroy
	 */
	public async destroyRoom(room: Room): Promise<void> {
		await GetDatabase().deleteChatRoom(room.id);
		await room.onDestroy();
		this._unloadRoom(room);
		logger.verbose(`Destroyed room ${room.id}`);

		ConnectionManagerClient.onRoomListChange();
	}

	/** Create room from received data, adding it to loaded rooms */
	private _loadRoom({ id, config, owners }: IChatRoomDirectoryData): Room {
		const room = new Room(id, config, owners);
		Assert(!this.loadedRooms.has(room.id));
		this.loadedRooms.set(room.id, room);
		loadedRoomsMetric.set(this.loadedRooms.size);
		logger.debug(`Loaded room ${room.id}`);
		return room;
	}

	/** Remove room from loaded rooms, running necessary cleanup actions */
	private _unloadRoom(room: Room): void {
		logger.debug(`Unloading room ${room.id}`);
		Assert(!room.isInUse());
		Assert(this.loadedRooms.get(room.id) === room);
		this.loadedRooms.delete(room.id);
		loadedRoomsMetric.set(this.loadedRooms.size);
	}
};
