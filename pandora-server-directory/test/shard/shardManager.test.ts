import { ShardManager } from '../../src/shard/shardManager';
import { Shard } from '../../src/shard/shard';
import { TestMockDb } from '../utils';

const TEST_SHARD_ID = 'shardTestId';

describe('ShardManager', () => {
	let shard1: Shard;
	let shard2: Shard;

	beforeAll(async () => {
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
