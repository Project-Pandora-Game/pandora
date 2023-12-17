import { RoomId, GetLogger, IShardChatRoomDefinition, Assert } from 'pandora-common';
import { PublicRoom } from './publicRoom';
import promClient from 'prom-client';
import { assetManager } from '../assets/assetManager';

const logger = GetLogger('RoomManager');

const roomsMetric = new promClient.Gauge({
	name: 'pandora_shard_rooms',
	help: 'Current count of rooms on this shard',
});

export const RoomManager = new class RoomManager {
	private readonly _rooms: Map<RoomId, PublicRoom> = new Map();

	public getRoom(id: RoomId): PublicRoom | undefined {
		return this._rooms.get(id);
	}

	public listRooms(): Pick<IShardChatRoomDefinition, 'id' | 'accessId'>[] {
		return [...this._rooms.values()]
			.map((room) => ({
				id: room.id,
				accessId: room.accessId,
			}));
	}

	public listRoomIds(): RoomId[] {
		return Array.from(this._rooms.keys());
	}

	public async loadRoom(definition: IShardChatRoomDefinition): Promise<PublicRoom | null> {
		const id = definition.id;

		let room = this._rooms.get(id);
		if (room) {
			room.update(definition);
			return room;
		}

		const data = await PublicRoom.load(id, definition.accessId);
		if (!data)
			return null;
		Assert(data.id === definition.id);

		room = this._rooms.get(id);
		if (room) {
			room.update(definition);
			return room;
		}

		logger.debug(`Adding room ${data.id}`);
		room = new PublicRoom({
			...data,
			id: definition.id,
			config: definition.config,
			accessId: definition.accessId,
			owners: definition.owners,
		});
		this._rooms.set(id, room);
		roomsMetric.set(this._rooms.size);
		return room;
	}

	public removeRoom(id: RoomId): Promise<void> {
		const room = this._rooms.get(id);
		if (!room)
			return Promise.resolve();
		logger.verbose(`Removing room ${id}`);
		room.onRemove();
		this._rooms.delete(id);
		roomsMetric.set(this._rooms.size);

		// Save all data after removing room
		return room.save();
	}

	public async removeAllRooms(): Promise<void> {
		await Promise.allSettled(
			Array.from(this._rooms.keys())
				.map((id) => this.removeRoom(id)),
		);
	}

	public onAssetDefinitionsChanged() {
		for (const room of this._rooms.values()) {
			room.reloadAssetManager(assetManager);
		}
	}
};
