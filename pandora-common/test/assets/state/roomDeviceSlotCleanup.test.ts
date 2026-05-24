import { describe, expect, it } from '@jest/globals';
import {
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
	GetDefaultAppearanceBundle,
	type AppearanceBundle,
	type AssetDefinition,
	type CharacterId,
	type ItemBundle,
	type ItemRoomDevice,
	type ItemRoomDeviceWearablePart,
} from '../../../src/index.ts';
import { DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG } from '../../../src/assets/state/roomLinkNodeDefinitions.ts';

describe('room device slot cleanup', () => {
	it('does not infer slot cleanup from character removal alone', () => {
		let state = CreateGlobalStateWithOccupiedDeviceSlots();

		state = state.withCharacter('c1', null);

		expect(GetRoomDevice(state).slotOccupancy).toEqual(new Map([
			['slot_1', 'c1'],
			['slot_2', 'c2'],
		]));
	});

	it('clears slots for explicit removed characters while keeping other slot links valid', () => {
		let state = CreateGlobalStateWithOccupiedDeviceSlots();
		state = state.withCharacter('c1', null);

		state = state.clearInvalidRoomDeviceSlotOccupancy('c1');

		const roomDevice = GetRoomDevice(state);
		expect(roomDevice.slotOccupancy).toEqual(new Map([
			['slot_2', 'c2'],
		]));
		expect(GetRoomDeviceWearablePart(state, 'c2').roomDevice).toBe(roomDevice);
	});

	it('clears slots for characters missing from the loaded space character set', () => {
		let state = CreateGlobalStateWithOccupiedDeviceSlots();
		state = state.withCharacter('c1', null);

		state = state.clearInvalidRoomDeviceSlotOccupancy();

		expect(GetRoomDevice(state).slotOccupancy).toEqual(new Map([
			['slot_2', 'c2'],
		]));
	});

	it('clears slots for characters that no longer have the matching room device wearable part', () => {
		let state = CreateGlobalStateWithOccupiedDeviceSlots();
		const character = state.characters.get('c1');
		expect(character).toBeDefined();
		state = state.withCharacter('c1', character!.produceWithItems([]));

		state = state.clearInvalidRoomDeviceSlotOccupancy();

		expect(GetRoomDevice(state).slotOccupancy).toEqual(new Map([
			['slot_2', 'c2'],
		]));
	});
});

function CreateGlobalStateWithOccupiedDeviceSlots(): AssetFrameworkGlobalState {
	const assetManager = CreateAssetManager();
	const space = AssetFrameworkSpaceState.loadFromBundle(assetManager, {
		rooms: [{
			id: 'room:default',
			name: '',
			description: '',
			items: [
				CreateRoomDeviceItemBundle({
					slot_1: 'c1',
					slot_2: 'c2',
				}),
			],
			position: { x: 0, y: 0 },
			roomGeometry: { type: 'defaultPublicSpace' },
			roomLinkNodes: DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG,
			direction: 'N',
			settings: {},
		}],
		spaceSettings: {},
		globalRoomSettings: {},
	}, 's/test', undefined);

	return AssetFrameworkGlobalState.loadFromBundle(assetManager, {
		stateId: 'test',
		space: space.exportToBundle(),
		characters: {
			c1: CreateAppearanceBundle('slot_1'),
			c2: CreateAppearanceBundle('slot_2'),
		},
	}, 's/test', undefined);
}

function CreateAssetManager(): AssetManager {
	const assets: AssetDefinition[] = [
		{
			type: 'roomDevice',
			id: 'a/room_device',
			name: 'Room Device',
			size: 'medium',
			pivot: { x: 0, y: 0 },
			credits: { credits: [], sourcePath: '' },
			slots: {
				slot_1: {
					name: 'Slot 1',
					wearableAsset: 'a/slot_1',
				},
				slot_2: {
					name: 'Slot 2',
					wearableAsset: 'a/slot_2',
				},
			},
		},
		{
			type: 'roomDeviceWearablePart',
			id: 'a/slot_1',
			name: 'Slot 1 Part',
			size: 'medium',
			credits: { credits: [], sourcePath: '' },
		},
		{
			type: 'roomDeviceWearablePart',
			id: 'a/slot_2',
			name: 'Slot 2 Part',
			size: 'medium',
			credits: { credits: [], sourcePath: '' },
		},
	];

	return new AssetManager('test', {
		assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
	});
}

function CreateRoomDeviceItemBundle(slotOccupancy: Record<string, CharacterId>): ItemBundle {
	return {
		id: 'i/room_device',
		asset: 'a/room_device',
		roomDeviceData: {
			deployment: {
				deployed: true,
				x: 0,
				y: 0,
				yOffset: 0,
			},
			slotOccupancy,
		},
	};
}

function CreateAppearanceBundle(slot: string): AppearanceBundle {
	return {
		...GetDefaultAppearanceBundle(),
		items: [{
			id: `i/${slot}`,
			asset: `a/${slot}`,
			roomDeviceLink: {
				device: 'i/room_device',
				slot,
			},
		}],
	};
}

function GetRoomDevice(state: AssetFrameworkGlobalState): ItemRoomDevice {
	const item = state.space.getRoom('room:default')?.items.find((i) => i.id === 'i/room_device');
	expect(item?.isType('roomDevice')).toBe(true);
	return item as ItemRoomDevice;
}

function GetRoomDeviceWearablePart(state: AssetFrameworkGlobalState, characterId: CharacterId): ItemRoomDeviceWearablePart {
	const item = state.characters.get(characterId)?.items[0];
	expect(item?.isType('roomDeviceWearablePart')).toBe(true);
	return item as ItemRoomDeviceWearablePart;
}
