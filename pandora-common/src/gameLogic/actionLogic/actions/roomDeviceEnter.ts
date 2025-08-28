import * as z from 'zod';
import { ActionTargetSelectorSchema, CharacterSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { ItemIdSchema } from '../../../assets/item/base.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomDeviceEnter = z.object({
	type: z.literal('roomDeviceEnter'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The slot the character wants to enter */
	slot: z.string(),
	/** The target character to enter the device */
	character: CharacterSelectorSchema,
	/** ID to give the new wearable part item */
	itemId: ItemIdSchema,
});

/** Put character into a room device. */
export function ActionRoomDeviceEnter({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceEnter>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return processingContext.invalid();

	// The slot must exist
	const slot = item.asset.definition.slots[action.slot];
	if (!slot)
		return processingContext.invalid();

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return processingContext.invalid();

	// Player must be able to interact with the device
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.DEVICE_ENTER_LEAVE);

	// We must have target character
	const targetCharacter = processingContext.getTarget(action.character);
	if (!targetCharacter)
		return processingContext.invalid();

	if (targetCharacter.type === 'character')
		processingContext.addInteraction(targetCharacter.character, 'deviceEnterLeave');

	const wearableItem = assetManager
		.createItem(action.itemId, asset, processingContext.player)
		.withLink(item, action.slot);
	// Player adding the wearable part must be able to use it
	processingContext.checkCanUseItemDirect(targetCharacter, [], wearableItem, ItemInteractionType.DEVICE_ENTER_LEAVE);

	// Actual action

	if (target === targetCharacter)
		return processingContext.invalid();

	const roomManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	const containerManipulator = roomManipulator.getContainer(action.item.container);
	const characterManipulator = processingContext.manipulator.getManipulatorFor(action.character);

	// Do change
	if (!containerManipulator.modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, action.character.characterId);
	}))
		return processingContext.invalid();

	if (!characterManipulator.addItem(wearableItem))
		return processingContext.invalid();

	if (!processingContext.manipulator.produceCharacterState(
		action.character.characterId,
		(character) => {
			const room = processingContext.manipulator.currentState.space.getRoom(character.currentRoom);
			if (room == null)
				return null;
			return character.updateRoomStateLink(room, false);
		},
	))
		return processingContext.invalid();

	// Change message to chat
	processingContext.queueMessage(
		characterManipulator.makeMessage({
			id: 'roomDeviceSlotEnter',
			item: item.getChatDescriptor(),
			dictionary: {
				ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
			},
		}),
	);

	return processingContext.finalize();
}

