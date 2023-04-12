import { Assert, AssertNever } from 'pandora-common';
import { Room } from '../../src/room/room';
import { RoomManager } from '../../src/room/roomManager';
import { Shard } from '../../src/shard/shard';
import { TestMockDb, TestMockShard, TestShardData } from '../utils';
import { TEST_ROOM, TEST_ROOM2, TEST_ROOM_DEV, TEST_ROOM_PANDORA_OWNED } from './testData';
import { Sleep } from '../../src/utility';

describe('Room', () => {
	let mockShard: TestShardData;
	let testRoom: Room;

	beforeAll(async () => {
		await TestMockDb();
		mockShard = await TestMockShard({
			messageHandler: {
				onMessage: async (messageType, _message, _context) => {
					// Break current call stack
					await Sleep(50);

					if (messageType === 'update') {
						return {};
					}

					AssertNever();
				},
			},
		});
	});

	afterAll(() => {
		mockShard.connection.disconnect();
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
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(false);

			const room = await RoomManager.createRoom(TEST_ROOM2, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});
			expect(room.assignedShard).toBe(null);

			await expect(room.connect()).resolves.toBe('noShardFound');
			expect(room.assignedShard).toBe(null);

			await RoomManager.destroyRoom(room);
			allowConnectSpy.mockRestore();
		});

		it('Uses random shard from available ones', async () => {
			const room = await RoomManager.createRoom(TEST_ROOM2, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});
			expect(room.assignedShard).toBe(null);

			const connectedShard = await room.connect();
			expect(connectedShard).toBe(mockShard.shard);
			expect(room.assignedShard).toBe(mockShard.shard);
			expect(mockShard.messageHandlerSpy).toHaveBeenCalledWith('update', expect.anything(), expect.anything());

			await RoomManager.destroyRoom(room);
		});

		it('Fails with unknown shard id from development data', async () => {
			const room = await RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: 'non-existent-shard',
				},
			}, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.assignedShard).toBe(null);

			await expect(room.connect()).resolves.toBe('noShardFound');
			expect(room.assignedShard).toBe(null);

			await RoomManager.destroyRoom(room);
		});

		it('Uses shard id from development data', async () => {
			const room = await RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: mockShard.shard.id,
				},
			}, TEST_ROOM_PANDORA_OWNED.slice());

			expect(room).toBeInstanceOf(Room);
			Assert(room instanceof Room);
			expect(room.getFullInfo()).toEqual({
				...TEST_ROOM_DEV,
				development: {
					shardId: mockShard.shard.id,
				},
				id: room.id,
				owners: TEST_ROOM_PANDORA_OWNED,
			});
			expect(room.assignedShard).toBe(null);

			const connectedShard = await room.connect();
			expect(connectedShard).toBe(mockShard.shard);
			expect(room.assignedShard).toBe(mockShard.shard);
			expect(mockShard.messageHandlerSpy).toHaveBeenCalledWith('update', expect.anything(), expect.anything());

			await RoomManager.destroyRoom(room);
		});
	});
});
