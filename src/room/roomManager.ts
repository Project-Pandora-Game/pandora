import { IChatRoomFullInfo, RoomId, GetLogger } from 'pandora-common';
import { Room } from './room';

const logger = GetLogger('RoomManager');

export const RoomManager = new class RoomManager {
	private readonly _rooms: Map<RoomId, Room> = new Map();

	public getRoom(id: RoomId): Room | undefined {
		return this._rooms.get(id);
	}

	public listRooms(): IChatRoomFullInfo[] {
		return [...this._rooms.values()]
			.map((room) => room.getInfo());
	}

	public listRoomIds(): RoomId[] {
		return Array.from(this._rooms.keys());
	}

	public loadRoom(roomData: IChatRoomFullInfo): Room {
		const id = roomData.id;

		let room = this._rooms.get(id);
		if (room) {
			room.update(roomData);
			return room;
		}

		logger.debug(`Creating room ${id}`);
		room = new Room(roomData);
		this._rooms.set(id, room);
		return room;
	}

	public removeRoom(id: RoomId): void {
		if (!this._rooms.has(id))
			return;
		logger.debug(`Removing room ${id}`);
		this._rooms.get(id)?.onRemove();
		this._rooms.delete(id);
	}
};
