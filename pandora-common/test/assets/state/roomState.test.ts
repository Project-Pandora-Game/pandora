import { AssetFrameworkRoomState, type ItemRoomDevice } from '../../../src';
import { CreateAssetManager, CreateItemBundle, CreateRoomDeviceAssetDefinition, CreateRoomState } from '../../stateUtils';

describe('AssetFrameworkRoomState', () => {
	describe('clearSlotsOccupiedByCharacter()', () => {
		it('should return itself if no slot occupied by character', () => {
			const roomState = createRoomStateWithRoomDeviceWithOccupiedSlots();

			const newRoomState = roomState.clearSlotsOccupiedByCharacter('c3');

			expect(newRoomState).toBe(roomState);
			expect((newRoomState.items.find((item) => item.id === 'i/room_device') as ItemRoomDevice).slotOccupancy).toEqual(new Map([
				['slot_1', 'c1'],
				['slot_2', 'c2'],
			]));
		});

		it('should clear slot if slot was occupied by character', () => {
			let roomState = createRoomStateWithRoomDeviceWithOccupiedSlots();

			roomState = roomState.clearSlotsOccupiedByCharacter('c2');

			expect((roomState.items.find((item) => item.id === 'i/room_device') as ItemRoomDevice).slotOccupancy).toEqual(new Map([
				['slot_1', 'c1'],
			]));
		});

		function createRoomStateWithRoomDeviceWithOccupiedSlots(): AssetFrameworkRoomState {
			return CreateRoomState({
				assetManager: CreateAssetManager({
					assets: [
						CreateRoomDeviceAssetDefinition({
							id: 'a/room_device',
							slots: {
								slot_1: { wearableAsset: 'a/slot_1' },
								slot_2: { wearableAsset: 'a/slot_2' },
							},
						}),
					],
				}),
				items: [
					CreateItemBundle({
						id: 'i/room_device',
						asset: 'a/room_device',
						roomDeviceData: {
							deployed: true,
							slotOccupancy: {
								slot_1: 'c1',
								slot_2: 'c2',
							},
						},
					}),
				],
			});
		}
	});
});
