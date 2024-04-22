import { AssetFrameworkRoomState, AssetManager, type ItemBundle, type ItemRoomDevice } from '../../../src';

describe('AssetFrameworkRoomState', () => {
	describe('clearSlotsOccupiedByCharacter()', () => {
		it('should return itself if no slot occupied by character', () => {
			const roomState = createRoomStateWithRoomDeviceWithOccupiedSlots();

			const newRoomState = roomState.clearSlotsOccupiedByCharacter('c3');

			expect(newRoomState).toBe(roomState);
			expect((newRoomState.items[0] as ItemRoomDevice).slotOccupancy).toEqual(new Map([
				['character_slot_1', 'c1'],
				['character_slot_2', 'c2'],
			]));
		});

		it('should clear slot if slot was occupied by character', () => {
			const roomState = createRoomStateWithRoomDeviceWithOccupiedSlots();

			const newRoomState = roomState.clearSlotsOccupiedByCharacter('c2');
			expect((newRoomState.items[0] as ItemRoomDevice).slotOccupancy).toEqual(new Map([
				['character_slot_1', 'c1'],
			]));
		});

		function createRoomStateWithRoomDeviceWithOccupiedSlots(): AssetFrameworkRoomState {
			const assetManager = new AssetManager('', {
				assets: {
					'a/1': {
						type: 'roomDevice',
						id: 'a/1',
						name: '',
						size: 'huge',
						pivot: { x: 0, y: 0 },
						slots: {
							character_slot_1: { name: '', wearableAsset: 'a/2' },
							character_slot_2: { name: '', wearableAsset: 'a/2' },
						},
						graphicsLayers: [],
					},
				},
			});
			const itemBundle: ItemBundle = {
				id: 'i/1',
				asset: 'a/1',
				roomDeviceData: {
					deployment: {
						deployed: true,
						x: 0,
						y: 0,
						yOffset: 0,
					},
					slotOccupancy: {
						character_slot_1: 'c1',
						character_slot_2: 'c2',
					},
				},
			};
			return AssetFrameworkRoomState.loadFromBundle(assetManager, { items: [itemBundle] }, undefined);
		}
	});
});
