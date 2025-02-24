import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes';
import { ItemInteractionType } from '../../../character/restrictionTypes';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionDeleteSchema = z.object({
	type: z.literal('delete'),
	/** Target with the item to delete */
	target: ActionTargetSelectorSchema,
	/** Path to the item to delete */
	item: ItemPathSchema,
});

/** Unequip and delete an item. */
export function ActionDelete({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionDeleteSchema>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// Player removing the item must be able to use it
	processingContext.checkCanUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);

	// Room device wearable parts cannot be deleted, you have to leave the device instead
	const item = target.getItem(action.item);
	if (item == null)
		return processingContext.invalid();

	if (item.isType('roomDeviceWearablePart'))
		return processingContext.invalid('noDeleteRoomDeviceWearable');

	// Deployed room devices cannot be deleted, you must store them first
	if (item.isType('roomDevice') && item.isDeployed())
		return processingContext.invalid('noDeleteDeployedRoomDevice');

	// Player must be allowed to delete the item
	processingContext.getPlayerRestrictionManager()
		.checkDeleteItem(processingContext, item);

	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const manipulator = targetManipulator.getContainer(container);

	// Do change
	const removedItems = manipulator.removeMatchingItems((i) => i.id === itemId);

	// Validate
	if (removedItems.length !== 1)
		return processingContext.invalid();

	// Change message to chat
	const manipulatorContainer = manipulator.container;
	processingContext.queueMessage(
		manipulator.makeMessage({
			id: (!manipulatorContainer && targetManipulator.isCharacter()) ? 'itemRemoveDelete' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
			item: removedItems[0].getChatDescriptor(),
		}),
	);

	return processingContext.finalize();
}
