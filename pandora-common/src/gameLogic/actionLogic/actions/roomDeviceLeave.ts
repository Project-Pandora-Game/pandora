import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { Assert } from '../../../utility/index.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomDeviceLeave = z.object({
	type: z.literal('roomDeviceLeave'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The slot that should be cleared */
	slot: z.string(),
});

/** Remove a character from a room device. */
export function ActionRoomDeviceLeave({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceLeave>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return processingContext.invalid();

	// The slot must exist and be occupied
	const slot = item.asset.definition.slots[action.slot];
	const occupyingCharacterId = item.slotOccupancy.get(action.slot);
	if (!slot || !occupyingCharacterId)
		return processingContext.invalid();

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return processingContext.invalid();

	// Player must be able to interact with the device
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.DEVICE_ENTER_LEAVE);

	const roomManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	// We try to find the character and remove the device cleanly.
	// If character is not found, we ignore it (assuming cleanup-style instead of freeing character)
	const targetCharacter = processingContext.getTarget({
		type: 'character',
		characterId: occupyingCharacterId,
	});

	let isCleanup = true;

	if (targetCharacter) {
		if (targetCharacter.type === 'character')
			processingContext.addInteraction(targetCharacter.character, 'deviceEnterLeave');

		const characterManipulator = processingContext.manipulator.getManipulatorFor({
			type: 'character',
			characterId: occupyingCharacterId,
		});

		// Find matching wearable part
		const wearablePart = characterManipulator.getRootItems().find((i) => i.asset === asset);

		// If we have a part to remove this is a free, not just cleanup
		if (wearablePart != null) {

			// Player must be able to remove the wearable part
			processingContext.checkCanUseItem(targetCharacter, {
				container: [],
				itemId: wearablePart.id,
			}, ItemInteractionType.DEVICE_ENTER_LEAVE);

			// Actually remove the item
			const removed = characterManipulator.removeMatchingItems((i) => i.asset === asset);
			Assert(removed.length === 1 && removed[0] === wearablePart);
			isCleanup = false;

			// Change message to chat
			processingContext.queueMessage(
				characterManipulator.makeMessage({
					id: 'roomDeviceSlotLeave',
					item: item.getChatDescriptor(),
					dictionary: {
						ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
					},
				}),
			);
		}
	}

	// Only after freeing character remove the reservation from the device - to do things in opposite order of putting character into it
	if (!roomManipulator.getContainer(action.item.container).modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, null);
	})) {
		return processingContext.invalid();
	}

	// If we didn't remove item from character, then this is just a cleanup, so send cleanup message
	if (isCleanup) {
		processingContext.queueMessage(
			roomManipulator.makeMessage({
				id: 'roomDeviceSlotClear',
				item: item.getChatDescriptor(),
				dictionary: {
					ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
				},
			}),
		);
	}

	return processingContext.finalize();
}
