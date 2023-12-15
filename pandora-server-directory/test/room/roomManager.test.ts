import { Assert, RoomId } from 'pandora-common';
import { Shard } from '../../src/shard/shard';
import { Room } from '../../src/room/room';
import { RoomManager } from '../../src/room/roomManager';
import { ShardManager } from '../../src/shard/shardManager';
import { TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV, TEST_ROOM_PANDORA_OWNED } from './testData';
import { TestMockAccount, TestMockDb } from '../utils';
import { GetDatabase } from '../../src/database/databaseProvider';

describe('RoomManager', () => {
	let shard: Shard;
	let testRoomId: RoomId;

	beforeAll(async () => {
		await TestMockDb();
		shard = ShardManager.getOrCreateShard({
			type: 'stable',
			id: 'test',
		});
		jest.spyOn(shard, 'allowConnect').mockReturnValue(true);
	});

	describe('createRoom()', () => {
		it.each([TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV])('Creates room', async (data) => {
			const room = await RoomManager.createRoom(data, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getConfig()).toEqual(data);
			expect(room.assignedShard).toBeNull();

			await expect(GetDatabase().getChatRoomById(room.id, null)).resolves.not.toBeNull();

			if (!testRoomId) {
				testRoomId = room.id;
			}
		});

		it('works even if there is room with same name already', async () => {
			expect(RoomManager.listLoadedRooms().some((r) => r.name === TEST_ROOM.name)).toBeTruthy();
			const room = await RoomManager.createRoom(TEST_ROOM, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getConfig()).toEqual(TEST_ROOM);
			expect(room.assignedShard).toBeNull();
		});

		it('Respects account room limit', async () => {
			const account = await TestMockAccount();
			const roomList: Room[] = [];

			const create = () => RoomManager.createRoom(TEST_ROOM, [account.id]);

			// Success until ownership
			expect(account.roomOwnershipLimit).toBeGreaterThan(0);
			for (let i = 0; i < account.roomOwnershipLimit; i++) {
				const room = await create();
				expect(room).toBeInstanceOf(Room);
				Assert(room instanceof Room);
				roomList.push(room);
			}
			expect(roomList).toHaveLength(account.roomOwnershipLimit);

			// Fails past threshold
			await expect(create()).resolves.toBe('roomOwnershipLimitReached');

			// Success after giving up a room and trying again
			await roomList[0].removeOwner(account.id);
			await expect(create()).resolves.toBeInstanceOf(Room);

			// Fails past reaching treshold again
			await expect(create()).resolves.toBe('roomOwnershipLimitReached');
		});
	});

	describe('getLoadedRoom()', () => {
		it('Gets loaded room by id', () => {
			const room = RoomManager.getLoadedRoom(testRoomId);
			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: testRoomId,
				owners: TEST_ROOM_PANDORA_OWNED,
			});
		});

		it('Returns undefined with unknown room', () => {
			const room = RoomManager.getLoadedRoom('r/NonexistentRoom');
			expect(room).toBe(null);
		});
	});

	describe('listLoadedRooms()', () => {
		it('Returns list of loaded rooms', () => {
			const rooms = RoomManager.listLoadedRooms();

			expect(rooms.map((r) => r.id)).toContain(testRoomId);
		});
	});
});
