import { AssetFrameworkGlobalState, type ItemRoomDeviceWearablePart } from '../../../src';
import { CreateAppearanceBundle, CreateAssetManager, CreateGlobalState, CreateItemBundle, CreateRoomDeviceAssetDefinition, CreateRoomDeviceWearablePartAssetDefinition } from '../../stateUtils';

describe('AssetFrameworkGlobalState', () => {
	describe('withCharacter()', () => {
		it('should update room state link when occupied slot was cleared', () => {
			// Characters c1 and c2 occupy slots in room device i/1
			let globalState = createGlobalStateWithRoomDeviceWithOccupiedSlots();

			// Remove character c1 from room and from room device
			globalState = globalState.withCharacter('c1', null);

			const roomDevice = globalState.room.items.find((item) => item.id === 'i/room_device');
			// Verify that character c2 is still linked to room device
			expect((globalState.characters.get('c2')?.items.find((item) => item.id === 'i/slot_2') as ItemRoomDeviceWearablePart).roomDevice).toBe(roomDevice);
		});

		function createGlobalStateWithRoomDeviceWithOccupiedSlots(): AssetFrameworkGlobalState {
			return CreateGlobalState({
				assetManager: CreateAssetManager({
					assets: [
						CreateRoomDeviceAssetDefinition({
							id: 'a/room_device',
							slots: {
								slot_1: { wearableAsset: 'a/slot_1' },
								slot_2: { wearableAsset: 'a/slot_2' },
							},
						}),
						CreateRoomDeviceWearablePartAssetDefinition({ id: 'a/slot_1' }),
						CreateRoomDeviceWearablePartAssetDefinition({ id: 'a/slot_2' }),
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
				characters: {
					'c1': CreateAppearanceBundle({
						items: [
							CreateItemBundle({
								id: 'i/slot_1',
								asset: 'a/slot_1',
								roomDeviceLink: {
									device: 'i/room_device',
									slot: 'slot_1',
								},
							}),
						],
					}),
					'c2': CreateAppearanceBundle({
						items: [
							CreateItemBundle({
								id: 'i/slot_2',
								asset: 'a/slot_2',
								roomDeviceLink: {
									device: 'i/room_device',
									slot: 'slot_2',
								},
							}),
						],
					}),
				},
			});
		}
	});
});
