import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Assert, SpaceId } from 'pandora-common';
import { GetDatabase } from '../../src/database/databaseProvider.ts';
import { Shard } from '../../src/shard/shard.ts';
import { ShardManager } from '../../src/shard/shardManager.ts';
import { Space } from '../../src/spaces/space.ts';
import { SpaceManager } from '../../src/spaces/spaceManager.ts';
import { TestMockAccount, TestMockDb } from '../utils.ts';
import { TEST_SPACE, TEST_SPACE2, TEST_SPACE_DEV, TEST_SPACE_PANDORA_OWNED } from './testData.ts';

describe('SpaceManager', () => {
	let shard: Shard;
	let testSpaceId: SpaceId;

	beforeAll(async () => {
		await TestMockDb();
		shard = ShardManager.getOrCreateShard({
			type: 'stable',
			id: 'test',
		});
		jest.spyOn(shard, 'allowConnect').mockReturnValue(true);
	});

	describe('createSpace()', () => {
		it.each([TEST_SPACE, TEST_SPACE2, TEST_SPACE_DEV])('Creates space', async (data) => {
			const space = await SpaceManager.createSpace(data, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual(data);
			expect(space.assignedShard).toBeNull();

			await expect(GetDatabase().getSpaceById(space.id, null)).resolves.not.toBeNull();

			if (!testSpaceId) {
				testSpaceId = space.id;
			}
		});

		it('works even if there is space with the same name already', async () => {
			expect(SpaceManager.listLoadedSpaces().some((s) => s.name === TEST_SPACE.name)).toBeTruthy();
			const space = await SpaceManager.createSpace(TEST_SPACE, TEST_SPACE_PANDORA_OWNED.slice());

			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual(TEST_SPACE);
			expect(space.assignedShard).toBeNull();
		});

		it('Respects account space limit', async () => {
			const account = await TestMockAccount();
			const spaceList: Space[] = [];

			const create = () => SpaceManager.createSpace(TEST_SPACE, [account.id]);

			// Success until ownership
			expect(account.spaceOwnershipLimit).toBeGreaterThan(0);
			for (let i = 0; i < account.spaceOwnershipLimit; i++) {
				const space = await create();
				expect(space).toBeInstanceOf(Space);
				Assert(space instanceof Space);
				spaceList.push(space);
			}
			expect(spaceList).toHaveLength(account.spaceOwnershipLimit);

			// Fails past threshold
			await expect(create()).resolves.toBe('spaceOwnershipLimitReached');

			// Success after giving up a space and trying again
			await spaceList[0].removeOwner(account.id);
			await expect(create()).resolves.toBeInstanceOf(Space);

			// Fails past reaching treshold again
			await expect(create()).resolves.toBe('spaceOwnershipLimitReached');
		});
	});

	describe('getLoadedSpace()', () => {
		it('Gets loaded space by id', () => {
			const space = SpaceManager.getLoadedSpace(testSpaceId);
			expect(space).toBeInstanceOf(Space);
			Assert(space instanceof Space);
			expect(space.getConfig()).toEqual(TEST_SPACE);
			expect(Array.from(space.owners)).toEqual(TEST_SPACE_PANDORA_OWNED);
		});

		it('Returns undefined with unknown space', () => {
			const space = SpaceManager.getLoadedSpace('s/NonexistentSpace');
			expect(space).toBe(null);
		});
	});

	describe('listLoadedSpaces()', () => {
		it('Returns list of loaded spaces', () => {
			const spaces = SpaceManager.listLoadedSpaces();

			expect(spaces.map((r) => r.id)).toContain(testSpaceId);
		});
	});
});
