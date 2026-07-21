import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Assert, AssertNever, type SpaceDirectoryConfig } from 'pandora-common';
import type { IDirectoryShardArgument, IDirectoryShardUpdate } from 'pandora-common/networking/api/directory_shard';
import type { Character } from '../../src/account/character.ts';
import { GetDatabase } from '../../src/database/databaseProvider.ts';
import { ConnectionManagerClient } from '../../src/networking/manager_client.ts';
import { ShardManager } from '../../src/shard/shardManager.ts';
import { Space } from '../../src/spaces/space.ts';
import { SpaceManager } from '../../src/spaces/spaceManager.ts';
import { TestMockAccount, TestMockCharacter, TestMockDb, TestMockShard, type TestShardData } from '../utils.ts';
import { TEST_SPACE, TEST_SPACE2, TEST_SPACE_PANDORA_OWNED } from './testData.ts';

describe('Space room device cleanup protocol', () => {
	const updates: Partial<IDirectoryShardUpdate>[] = [];
	let mockShard: TestShardData;

	beforeAll(async () => {
		await TestMockDb();
		mockShard = await TestMockShard({
			messageHandler: {
				// @ts-expect-error: Mock that handles only part of the messages
				onMessage: async (messageType, message) => {
					await Promise.resolve();
					if (messageType === 'update') {
						updates.push(message as IDirectoryShardArgument['update']);
						return {};
					}
					if (messageType === 'spaceCheckCanLeave') {
						return { result: 'ok' };
					}

					AssertNever();
				},
			},
		});
	});

	beforeEach(() => {
		updates.length = 0;
	});

	afterEach(async () => {
		await SpaceManager.onDestroy();
		ConnectionManagerClient._throttledOnSpaceListChange.cancel();
	});

	afterAll(async () => {
		await ShardManager.onDestroy();
	});

	it('sends removal cleanup intent in the same update that removes a character from a loaded space', async () => {
		const space = await CreateLoadedSpaceWithCharacter(TEST_SPACE);
		const character = GetOnlyLoadedCharacter(space);
		const shard = space.assignedShard;
		Assert(shard != null);

		updates.length = 0;
		await space.removeCharacter(character, 'kick', null);

		expect(updates).toHaveLength(1);
		expect(updates[0]).toEqual(expect.objectContaining({
			characters: [expect.objectContaining({
				id: character.baseInfo.id,
				space: null,
			})],
			spaces: [expect.objectContaining({
				id: space.id,
			})],
			spaceCharacterRemovals: {
				[space.id]: [{
					character: character.baseInfo.id,
					reason: 'kick',
				}],
			},
		}));

		await space.cleanupIfEmpty();
	});

	it('does not send cleanup intent when a loaded empty space unloads from the shard', async () => {
		const space = await SpaceManager.createSpace({
			...TEST_SPACE2,
			development: {
				shardId: mockShard.shard.id,
			},
		}, TEST_SPACE_PANDORA_OWNED.slice());
		expect(space).toBeInstanceOf(Space);
		Assert(space instanceof Space);
		await space.connect();

		updates.length = 0;
		await space.cleanupIfEmpty();

		expect(updates).toHaveLength(1);
		expect(updates[0]).toEqual(expect.objectContaining({
			spaces: [],
		}));
		expect(updates[0]?.spaceCharacterRemovals).toBeUndefined();
	});
});

async function CreateLoadedSpaceWithCharacter(config: SpaceDirectoryConfig): Promise<Space> {
	const account = await TestMockAccount();
	const character = await TestMockCharacter(account);
	const space = await SpaceManager.createSpace(config, TEST_SPACE_PANDORA_OWNED.slice());
	expect(space).toBeInstanceOf(Space);
	Assert(space instanceof Space);

	await GetDatabase().updateCharacter(character.id, {
		currentSpace: space.id,
	}, null);

	character.load(space);
	await space.connect();

	return space;
}

function GetOnlyLoadedCharacter(space: Space): Character {
	const characters = Array.from(space.characters);
	expect(characters).toHaveLength(1);
	return characters[0];
}
