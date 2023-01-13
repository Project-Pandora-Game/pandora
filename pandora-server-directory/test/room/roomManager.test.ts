import { IChatRoomDirectoryConfig, RoomId } from 'pandora-common';
import { Shard } from '../../src/shard/shard';
import { Room } from '../../src/room/room';
import { RoomManager } from '../../src/room/roomManager';
import { ShardManager } from '../../src/shard/shardManager';

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
	background: {
		image: '#1099bb',
		size: [1000, 1000],
		scaling: 0,
	},
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

describe('RoomManager', () => {
	let shard: Shard;

	beforeAll(() => {
		shard = ShardManager.getOrCreateShard(null);
		jest.spyOn(shard, 'allowConnect').mockReturnValue(true);
	});

	describe('createRoom()', () => {
		it('Uses given shard and id', () => {
			const room = RoomManager.createRoom(TEST_ROOM, shard, TEST_ROOM_ID);

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: TEST_ROOM_ID,
			});
			expect((room as Room).assignedShard).toBe(shard);
		});

		it('Fails if there is room with same name', () => {
			expect(RoomManager.createRoom(TEST_ROOM)).toBe('nameTaken');
		});

		it('Errors if there is room with same id', () => {
			expect(() => {
				RoomManager.createRoom(TEST_ROOM2, undefined, TEST_ROOM_ID);
			}).toThrow();
		});

		it('Uses random shard from available ones', () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(true);

			const room = RoomManager.createRoom(TEST_ROOM2);

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM2,
				id: (room as Room).id,
			});

			allowConnectSpy.mockRestore();
		});

		it('Fails with unknown shard id from development data', () => {
			const room = RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: 'non-existent-shard',
				},
			});

			expect(room).toBe('noShardFound');
		});

		it('Uses shard id from development data', () => {
			const room = RoomManager.createRoom({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard.id,
				},
			});

			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM_DEV,
				development: {
					shardId: shard.id,
				},
				id: (room as Room).id,
			});
			expect((room as Room).assignedShard).toBe(shard);
		});
	});

	describe('getRoom()', () => {
		it('Gets room by id', () => {
			const room = RoomManager.getRoom(TEST_ROOM_ID);
			expect(room).toBeInstanceOf(Room);
			expect((room as Room).getFullInfo()).toEqual({
				...TEST_ROOM,
				id: TEST_ROOM_ID,
			});
		});

		it('Returns undefined with unknown room', () => {
			const room = RoomManager.getRoom('rNonexistentRoom');
			expect(room).toBe(undefined);
		});
	});

	describe('listRooms()', () => {
		it('Returns list of existing rooms', () => {
			const rooms = RoomManager.listRooms();

			expect(rooms).toHaveLength(3);
			expect(rooms.map((r) => r.id)).toContain(TEST_ROOM_ID);
		});
	});

	describe('destroyRoom()', () => {
		it('Deletes room by instance', () => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const room = RoomManager.getRoom(TEST_ROOM_ID)!;
			expect(room).toBeInstanceOf(Room);

			const roomonDestroySpy = jest.spyOn(room, 'onDestroy');

			RoomManager.destroyRoom(room);

			// Not gettable
			expect(RoomManager.getRoom(TEST_ROOM_ID)).toBe(undefined);
			expect(RoomManager.listRooms()).not.toContain(room);
			// Destructor called
			expect(roomonDestroySpy).toHaveBeenCalledTimes(1);
		});
	});
});
