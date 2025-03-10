import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Assert, AssertNever } from 'pandora-common';
import { GetDatabase } from '../../src/database/databaseProvider.ts';
import { Shard } from '../../src/shard/shard.ts';
import { ShardManager } from '../../src/shard/shardManager.ts';
import { Space } from '../../src/spaces/space.ts';
import { SpaceManager } from '../../src/spaces/spaceManager.ts';
import { Sleep } from '../../src/utility.ts';
import { TestMockDb, TestMockShard, TestShardData } from '../utils.ts';
import { TEST_SPACE, TEST_SPACE2, TEST_SPACE_DEV, TEST_SPACE_PANDORA_OWNED } from './testData.ts';

describe('Space', () => {
	let mockShard: TestShardData;
	let testSpace: Space;

	beforeAll(async () => {
		await TestMockDb();
		mockShard = await TestMockShard({
			messageHandler: {
				// @ts-expect-error: Mock that handles only part of the messages
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

	afterAll(async () => {
		await ShardManager.onDestroy();
	});

	describe('constructor', () => {
		it('works', async () => {
			const space = await SpaceManager.createSpace(TEST_SPACE, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			testSpace = space;
		});
	});

	describe('name getter', () => {
		it('returns correct name', () => {
			expect(testSpace.name).toBe(TEST_SPACE.name);
		});
	});

	describe('connect()', () => {
		it('Fails when there is no shard', async () => {
			const allowConnectSpy = jest.spyOn(Shard.prototype, 'allowConnect');
			allowConnectSpy.mockReturnValue(false);

			const space = await SpaceManager.createSpace(TEST_SPACE2, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual(TEST_SPACE2);
			expect(Array.from(space.owners)).toEqual(TEST_SPACE_PANDORA_OWNED);
			expect(space.assignedShard).toBe(null);

			await expect(space.connect()).resolves.toBe('noShardFound');
			expect(space.assignedShard).toBe(null);

			await space.delete();
			allowConnectSpy.mockRestore();
		});

		it('Uses random shard from available ones', async () => {
			const space = await SpaceManager.createSpace(TEST_SPACE2, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual(TEST_SPACE2);
			expect(Array.from(space.owners)).toEqual(TEST_SPACE_PANDORA_OWNED);
			expect(space.assignedShard).toBe(null);

			const connectedShard = await space.connect();
			expect(connectedShard).toBe(mockShard.shard);
			expect(space.assignedShard).toBe(mockShard.shard);
			expect(mockShard.messageHandlerSpy).toHaveBeenCalledWith('update', expect.anything(), expect.anything());

			await space.delete();
		});

		it('Fails with unknown shard id from development data', async () => {
			const space = await SpaceManager.createSpace({
				...TEST_SPACE_DEV,
				development: {
					shardId: 'non-existent-shard',
				},
			}, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.assignedShard).toBe(null);

			await expect(space.connect()).resolves.toBe('noShardFound');
			expect(space.assignedShard).toBe(null);

			await space.delete();
		});

		it('Uses shard id from development data', async () => {
			const space = await SpaceManager.createSpace({
				...TEST_SPACE_DEV,
				development: {
					shardId: mockShard.shard.id,
				},
			}, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual({
				...TEST_SPACE_DEV,
				development: {
					shardId: mockShard.shard.id,
				},
			});
			expect(Array.from(space.owners)).toEqual(TEST_SPACE_PANDORA_OWNED);
			expect(space.assignedShard).toBe(null);

			const connectedShard = await space.connect();
			expect(connectedShard).toBe(mockShard.shard);
			expect(space.assignedShard).toBe(mockShard.shard);
			expect(mockShard.messageHandlerSpy).toHaveBeenCalledWith('update', expect.anything(), expect.anything());

			await space.delete();
		});
	});

	describe('delete()', () => {
		it('Deletes and invalidates unloaded space', async () => {
			const space = await SpaceManager.createSpace(TEST_SPACE, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);

			await space.delete();

			expect(space.isValid).toBeFalsy();
			await expect(GetDatabase().getSpaceById(space.id, null)).resolves.toBeNull();
		});

		it('Deletes and invalidates loaded space', async () => {
			const space = await SpaceManager.createSpace(TEST_SPACE, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);

			const connectedShard = await space.connect();
			expect(connectedShard).toBe(mockShard.shard);
			expect(space.assignedShard).toBe(mockShard.shard);
			Assert(typeof connectedShard !== 'string');

			await space.delete();

			expect(space.isValid).toBeFalsy();
			expect(space.assignedShard).toBeNull();
			expect(connectedShard.spaces.get(space.id)).toBeUndefined();
			await expect(GetDatabase().getSpaceById(space.id, null)).resolves.toBeNull();
		});
	});
});
