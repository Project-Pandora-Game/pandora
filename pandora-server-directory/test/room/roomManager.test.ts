import { Assert, RoomId } from 'pandora-common';
import { Shard } from '../../src/shard/shard';
import { Room } from '../../src/room/room';
import { RoomManager } from '../../src/room/roomManager';
import { ShardManager } from '../../src/shard/shardManager';
import { TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV } from './testData';
import { TestMockDb } from '../utils';

describe('RoomManager', () => {
	let shard: Shard;
	let testRoomId: RoomId;

	beforeAll(async () => {
		await TestMockDb();
		shard = ShardManager.getOrCreateShard(null);
		jest.spyOn(shard, 'allowConnect').mockReturnValue(true);
	});

	describe('createRoom()', () => {
		it.each([TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV])('Creates room', async (data) => {
			const room = await RoomManager.createRoom(data);

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			if (!testRoomId) {
				testRoomId = room.id;
			}

			expect(room.getFullInfo()).toEqual({
				...data,
				id: room.id,
			});
			expect(room.assignedShard).toBeNull();
		});

		it('Fails if there is room with same name', async () => {
			await expect(RoomManager.createRoom(TEST_ROOM)).resolves.toBe('nameTaken');
		});
	});

	describe('getRoom()', () => {
		it('Gets room by id', () => {
			const room = RoomManager.getRoom(testRoomId);
			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: testRoomId,
			});
		});

		it('Returns undefined with unknown room', () => {
			const room = RoomManager.getRoom('r/NonexistentRoom');
			expect(room).toBe(undefined);
		});
	});

	describe('listRooms()', () => {
		it('Returns list of existing rooms', () => {
			const rooms = RoomManager.listRooms();

			expect(rooms).toHaveLength(3);
			expect(rooms.map((r) => r.id)).toContain(testRoomId);
		});
	});

	describe('destroyRoom()', () => {
		it('Deletes room by instance', async () => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const room = RoomManager.getRoom(testRoomId)!;
			expect(room).toBeInstanceOf(Room);

			const roomonDestroySpy = jest.spyOn(room, 'onDestroy');

			await RoomManager.destroyRoom(room);

			// Not gettable
			expect(RoomManager.getRoom(testRoomId)).toBe(undefined);
			expect(RoomManager.listRooms()).not.toContain(room);
			// Destructor called
			expect(roomonDestroySpy).toHaveBeenCalledTimes(1);
		});
	});
});
