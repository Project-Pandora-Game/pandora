import { IChatRoomDirectoryConfig, LogLevel, RoomId, SetConsoleOutput } from 'pandora-common';
import { ShardManager } from '../../src/shard/shardManager';
import { Shard } from '../../src/shard/shard';
import { Room } from '../../src/shard/room';
import { TestMockDb } from '../utils';

const TEST_SHARD_ID = 'shardTestId';
const TEST_ROOM_ID: RoomId = 'rTestId';

const TEST_ROOM_DEFAULTS: Readonly<IChatRoomDirectoryConfig> = {
	name: '',
	description: '',
	maxUsers: 10,
	admin: [],
	banned: [],
	protected: false,
	password: null,
	features: [],
	background: '#1099bb',
	size: [1000, 1000],
	scaling: 0,
};

const TEST_ROOM: IChatRoomDirectoryConfig = {
	...TEST_ROOM_DEFAULTS,
	name: 'test',
	description: 'Some description',
	admin: [1],
	banned: [2],
};

const TEST_ROOM2: IChatRoomDirectoryConfig = {
	...TEST_ROOM_DEFAULTS,
	name: 'test2',
	description: 'Another description',
	maxUsers: 7,
	protected: true,
	password: 'abcd',
	admin: [2],
	banned: [22, 13],
};
const TEST_ROOM_DEV: IChatRoomDirectoryConfig = {
	...TEST_ROOM_DEFAULTS,
	name: 'test-dev',
	description: 'Development room',
	admin: [1],
	features: ['development'],
	development: {
	},
};

describe('ShardManager', () => {
	let shard1: Shard;
	let shard2: Shard;

	beforeAll(async () => {
		SetConsoleOutput(LogLevel.FATAL);
		await TestMockDb();
	});

	describe('getOrCreateShard()', () => {
		it('Creates shard if passed null', () => {
			shard1 = ShardManager.getOrCreateShard(null);
			expect(shard1).toBeInstanceOf(Shard);
		});

		it('Creates shard with unknown id', () => {
			shard2 = ShardManager.getOrCreateShard(TEST_SHARD_ID);
			expect(shard2).toBeInstanceOf(Shard);
			expect(shard2).not.toBe(shard1);
			expect(shard2.id).toBe(TEST_SHARD_ID);
		});

		it('Returns existing shard with known id', () => {
			expect(ShardManager.getOrCreateShard(shard1.id)).toBe(shard1);
			expect(ShardManager.getOrCreateShard(shard2.id)).toBe(shard2);
		});
	});

	describe('getShard()', () => {
		it('Returns shard with known id', () => {
			expect(ShardManager.getShard(shard1.id)).toBe(shard1);
			expect(ShardManager.getShard(shard2.id)).toBe(shard2);
		});

		it('Returns null with unknown id', () => {
			expect(ShardManager.getShard('nonexistentId')).toBe(null);
		});
	});

	describe('listShads()', () => {
		it('Returns info of shards that can be connected to', () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockImplementation(function (this: Shard) {
				return this === shard1;
			});

			expect(ShardManager.listShads()).toEqual([shard1.getInfo()]);

			allowConnectSpy.mockRestore();
		});
	});

	describe('getRandomShard()', () => {
		it('Returns random shard that can be connected to', () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockImplementation(function (this: Shard) {
				return this === shard1;
			});

			expect(ShardManager.getRandomShard()).toBe(shard1);

			allowConnectSpy.mockRestore();
		});

		it('Returns null if no shard can be connected to', () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(false);

			expect(ShardManager.getRandomShard()).toBe(null);

			allowConnectSpy.mockRestore();
		});
	});

	describe('deleteShard()', () => {
		it('Ignores unknown id', async () => {
			const shard1onDeleteSpy = jest.spyOn(shard1, 'onDelete');
			const shard2onDeleteSpy = jest.spyOn(shard2, 'onDelete');

			await ShardManager.deleteShard('nonexistentId');

			expect(ShardManager.getShard(shard1.id)).toBe(shard1);
			expect(shard1onDeleteSpy).not.toHaveBeenCalled();
			expect(ShardManager.getShard(shard2.id)).toBe(shard2);
			expect(shard2onDeleteSpy).not.toHaveBeenCalled();
		});

		it('Deletes shard by id', async () => {
			const shard1onDeleteSpy = jest.spyOn(shard1, 'onDelete');
			const shard2onDeleteSpy = jest.spyOn(shard2, 'onDelete');

			await ShardManager.deleteShard(shard1.id);

			// Not gettable
			expect(ShardManager.getShard(shard1.id)).toBe(null);
			// Destructor called
			expect(shard1onDeleteSpy).toHaveBeenCalledTimes(1);
			// Other shards unaffected
			expect(ShardManager.getShard(shard2.id)).toBe(shard2);
			expect(shard2onDeleteSpy).not.toHaveBeenCalled();
		});
	});

	describe('createRoom()', () => {
		it('Fails if there is no shard available', () => {
			expect(ShardManager.createRoom(TEST_ROOM)).toBe('noShardFound');
		});

		it('Uses given shard and id', () => {
			const room = ShardManager.createRoom(TEST_ROOM, shard2, TEST_ROOM_ID);

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: TEST_ROOM_ID,
			});
			expect((room as Room).shard).toBe(shard2);
		});

		it('Fails if there is room with same name', () => {
			expect(ShardManager.createRoom(TEST_ROOM)).toBe('nameTaken');
		});

		it('Errors if there is room with same id', () => {
			expect(() => {
				ShardManager.createRoom(TEST_ROOM2, undefined, TEST_ROOM_ID);
			}).toThrow();
		});

		it('Uses random shard from available ones', () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(true);

			const room = ShardManager.createRoom(TEST_ROOM2);

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: (room as Room).id,
			});

			allowConnectSpy.mockRestore();
		});

		it('Fails with unknown shard id from development data', () => {
			const room = ShardManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: 'non-existent-shard',
				},
			});

			expect(room).toBe('noShardFound');
		});

		it('Uses shard id from development data', () => {
			const room = ShardManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard2.id,
				},
			});

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard2.id,
				},
				id: (room as Room).id,
			});
			expect((room as Room).shard).toBe(shard2);
		});
	});

	describe('getRoom()', () => {
		it('Gets room by id', () => {
			const room = ShardManager.getRoom(TEST_ROOM_ID);
			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: TEST_ROOM_ID,
			});
		});

		it('Returns undefined with unknown room', () => {
			const room = ShardManager.getRoom('rNonexistentRoom');
			expect(room).toBe(undefined);
		});
	});

	describe('listRooms()', () => {
		it('Returns list of existing rooms', () => {
			const rooms = ShardManager.listRooms();

			expect(rooms).toHaveLength(3);
			expect(rooms.map((r) => r.id)).toContain(TEST_ROOM_ID);
		});
	});

	describe('destroyRoom()', () => {
		it('Deletes room by instance', () => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const room = ShardManager.getRoom(TEST_ROOM_ID)!;
			expect(room).toBeInstanceOf(Room);

			const roomonDestroySpy = jest.spyOn(room, 'onDestroy');

			ShardManager.destroyRoom(room);

			// Not gettable
			expect(ShardManager.getRoom(TEST_ROOM_ID)).toBe(undefined);
			expect(ShardManager.listRooms()).not.toContain(room);
			// Destructor called
			expect(roomonDestroySpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('onDestroy()', () => {
		it('Deletes all shards', async () => {
			const shard2onDeleteSpy = jest.spyOn(shard2, 'onDelete');

			await ShardManager.onDestroy();

			// Not gettable
			expect(ShardManager.getShard(shard1.id)).toBe(null);
			expect(ShardManager.getShard(shard2.id)).toBe(null);
			// Destructor called
			expect(shard2onDeleteSpy).toHaveBeenCalledTimes(1);
		});
	});
});
