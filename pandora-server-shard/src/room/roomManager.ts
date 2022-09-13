import { IChatRoomFullInfo, RoomId, GetLogger } from 'pandora-common';
import { Room } from './room';
import promClient from 'prom-client';

const logger = GetLogger('RoomManager');

const roomsMetric = new promClient.Gauge({
	name: 'pandora_shard_rooms',
	help: 'Current count of rooms on this shard',
});

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
		roomsMetric.set(this._rooms.size);
		return room;
	}

	public removeRoom(id: RoomId): void {
		if (!this._rooms.has(id))
			return;
		logger.debug(`Removing room ${id}`);
		this._rooms.get(id)?.onRemove();
		this._rooms.delete(id);
		roomsMetric.set(this._rooms.size);
	}

	public removeAllRooms(): void {
		Array.from(this._rooms.keys())
			.map((id) => this.removeRoom(id));
	}
};
