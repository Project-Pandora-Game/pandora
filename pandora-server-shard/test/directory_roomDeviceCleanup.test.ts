import { describe, expect, it, jest } from '@jest/globals';
import type { IDirectoryShardUpdate, IShardCharacterDefinition, IShardSpaceDefinition, SpaceId } from 'pandora-common';
import type { Character } from '../src/character/character.ts';
import { CharacterManager } from '../src/character/characterManager.ts';
import { SocketIODirectoryConnector } from '../src/networking/socketio_directory_connector.ts';
import type { PublicSpace } from '../src/spaces/publicSpace.ts';
import { SpaceManager } from '../src/spaces/spaceManager.ts';

type TestSpace = {
	readonly id: SpaceId;
	clearRoomDeviceSlotsOccupiedByCharacter: jest.Mock<(character: string) => void>;
	clearInvalidRoomDeviceSlotOccupancy: jest.Mock<() => void>;
	runAutomaticActions: jest.Mock<() => void>;
	processDirectoryMessages: jest.Mock<() => void>;
};

describe('Directory room device slot cleanup updates', () => {
	it('cleans explicit removals before unloading a space in the same update', async () => {
		const harness = CreateUpdateHarness();
		harness.addSpace('s/test');

		await harness.update({
			spaces: [],
			characters: [],
			spaceCharacterRemovals: {
				's/test': [{
					character: 'c1',
					reason: 'kick',
				}],
			},
		});

		expect(harness.events).toEqual([
			'cleanup:s/test:c1',
			'removeSpace:s/test',
		]);
	});

	it('does not reconcile missing characters for a space being unloaded', async () => {
		const harness = CreateUpdateHarness();
		const space = harness.addSpace('s/test');

		await harness.update({
			spaces: [],
			characters: [],
		});

		expect(space.clearInvalidRoomDeviceSlotOccupancy).not.toHaveBeenCalled();
		expect(space.clearRoomDeviceSlotsOccupiedByCharacter).not.toHaveBeenCalled();
		expect(harness.events).toEqual([
			'removeSpace:s/test',
		]);
	});

	it('reconciles stale slots after loading the current characters for a running space', async () => {
		const harness = CreateUpdateHarness();

		await harness.update({
			spaces: [
				CreateSpaceDefinition('s/test'),
			],
			characters: [
				CreateCharacterDefinition('c2', 's/test'),
			],
		});

		expect(harness.events).toEqual([
			'loadSpace:s/test',
			'loadCharacter:c2',
			'clearMissing:s/test',
			'tick:s/test',
		]);
	});

	it('does not clean slots on the old shard during migration unload, but does reconcile on the new shard load', async () => {
		const oldShard = CreateUpdateHarness();
		const oldSpace = oldShard.addSpace('s/test');

		await oldShard.update({
			spaces: [],
			characters: [],
		});

		expect(oldSpace.clearInvalidRoomDeviceSlotOccupancy).not.toHaveBeenCalled();
		expect(oldShard.events).toEqual([
			'removeSpace:s/test',
		]);

		const newShard = CreateUpdateHarness();
		await newShard.update({
			spaces: [
				CreateSpaceDefinition('s/test'),
			],
			characters: [
				CreateCharacterDefinition('c2', 's/test'),
			],
		});

		expect(newShard.events).toEqual([
			'loadSpace:s/test',
			'loadCharacter:c2',
			'clearMissing:s/test',
			'tick:s/test',
		]);
	});
});

function CreateUpdateHarness(): {
	readonly events: string[];
	addSpace(id: SpaceId): TestSpace;
	update(update: Partial<IDirectoryShardUpdate>): Promise<void>;
} {
	const events: string[] = [];
	const spaces = new Map<SpaceId, TestSpace>();

	jest.restoreAllMocks();

	jest.spyOn(SpaceManager, 'getSpace').mockImplementation((id) => {
		const space = spaces.get(id);
		return space == null ? undefined : AsPublicSpace(space);
	});
	jest.spyOn(SpaceManager, 'getAllSpaces').mockImplementation(() => [...spaces.values()].map(AsPublicSpace));
	jest.spyOn(SpaceManager, 'listSpaceIds').mockImplementation(() => [...spaces.keys()]);
	jest.spyOn(SpaceManager, 'loadSpace').mockImplementation((definition) => {
		events.push(`loadSpace:${definition.id}`);
		return Promise.resolve(AsPublicSpace(spaces.get(definition.id) ?? addSpace(definition.id)));
	});
	jest.spyOn(SpaceManager, 'removeSpace').mockImplementation((id) => {
		events.push(`removeSpace:${id}`);
		spaces.delete(id);
		return Promise.resolve();
	});

	jest.spyOn(CharacterManager, 'listCharacters').mockReturnValue([] as never);
	jest.spyOn(CharacterManager, 'removeCharacter').mockReturnValue(Promise.resolve());
	jest.spyOn(CharacterManager, 'loadCharacter').mockImplementation((definition) => {
		events.push(`loadCharacter:${definition.id}`);
		const character: Pick<Character, 'id' | 'loadedSpace'> = {
			id: definition.id,
			loadedSpace: undefined,
		};
		return Promise.resolve(character as Character);
	});
	jest.spyOn(CharacterManager, 'getValidCharacters').mockReturnValue([] as never);

	const connector = new SocketIODirectoryConnector('ws://pandora.invalid');
	const update = (data: Partial<IDirectoryShardUpdate>) =>
		(connector as unknown as {
			updateFromDirectory(update: Partial<IDirectoryShardUpdate>): Promise<void>;
		}).updateFromDirectory(data);

	return {
		events,
		addSpace,
		update,
	};

	function addSpace(id: SpaceId): TestSpace {
		const space: TestSpace = {
			id,
			clearRoomDeviceSlotsOccupiedByCharacter: jest.fn((character) => {
				events.push(`cleanup:${id}:${character}`);
			}),
			clearInvalidRoomDeviceSlotOccupancy: jest.fn(() => {
				events.push(`clearMissing:${id}`);
			}),
			runAutomaticActions: jest.fn(() => {
				events.push(`tick:${id}`);
			}),
			processDirectoryMessages: jest.fn(),
		};
		spaces.set(id, space);
		return space;
	}
}

function CreateSpaceDefinition(id: SpaceId): IShardSpaceDefinition {
	return {
		id,
		accessId: `access-${id}`,
		config: {
			name: 'Test space',
			description: '',
			public: 'private',
			maxUsers: 10,
			admin: [],
			allow: [],
			banned: [],
			entryText: '',
			features: [],
			ghostManagement: null,
		},
		owners: [],
		ownerInvites: [],
		spaceSwitchStatus: [],
	};
}

function CreateCharacterDefinition(id: IShardCharacterDefinition['id'], space: SpaceId): IShardCharacterDefinition {
	return {
		id,
		account: {
			id: 1,
			displayName: 'Test account',
			onlineStatus: 'online',
		},
		accessId: `access-${id}`,
		connectSecret: null,
		space,
	};
}

function AsPublicSpace(space: TestSpace): PublicSpace {
	return space as unknown as PublicSpace;
}
