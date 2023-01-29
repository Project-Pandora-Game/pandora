import { Assert } from 'pandora-common';
import { Room } from '../../src/room/room';
import { RoomManager } from '../../src/room/roomManager';
import { Shard } from '../../src/shard/shard';
import { ShardManager } from '../../src/shard/shardManager';
import { TestMockDb } from '../utils';
import { TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV, TEST_ROOM_PANDORA_OWNED } from './testData';

describe('Room', () => {
	let shard: Shard;
	let testRoom: Room;

	beforeAll(async () => {
		await TestMockDb();
		shard = ShardManager.getOrCreateShard(null);
	});

	describe('constructor', () => {
		it('works', async () => {
			const room = await RoomManager.createRoom(TEST_ROOM, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			testRoom = room;
		});
	});

	describe('name getter', () => {
		it('returns correct name', () => {
			expect(testRoom.name).toBe(TEST_ROOM.name);
		});
	});

	describe('connect()', () => {
		it('Fails when there is no shard', async () => {
			const room = await RoomManager.createRoom(TEST_ROOM2, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});

			await expect(room.connect()).resolves.toBe('noShardFound');
			expect(room.assignedShard).toBe(null);

			await RoomManager.destroyRoom(room);
		});

		it('Uses random shard from available ones', async () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(true);

			const room = await RoomManager.createRoom(TEST_ROOM2, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});

			await expect(room.connect()).resolves.toBe(shard);
			expect(room.assignedShard).toBe(shard);

			await RoomManager.destroyRoom(room);
			allowConnectSpy.mockRestore();
		});

		it('Fails with unknown shard id from development data', async () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(true);

			const room = await RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: 'non-existent-shard',
				},
			}, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);

			await expect(room.connect()).resolves.toBe('noShardFound');
			expect(room.assignedShard).toBe(null);

			await RoomManager.destroyRoom(room);
			allowConnectSpy.mockRestore();
		});

		it('Uses shard id from development data', async () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(true);

			const room = await RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard.id,
				},
			}, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard.id,
				},
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});

			await expect(room.connect()).resolves.toBe(shard);
			expect(room.assignedShard).toBe(shard);

			await RoomManager.destroyRoom(room);
			allowConnectSpy.mockRestore();
		});
	});
});
