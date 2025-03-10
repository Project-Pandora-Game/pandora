import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionMove = z.object({
	type: z.literal('move'),
	/** Target with the item to move */
	target: ActionTargetSelectorSchema,
	/** Path to the item to move */
	item: ItemPathSchema,
	/** Relative shift for the item inside its container */
	shift: z.number().int(),
});

/** Moves an item within inventory, reordering the worn order. */
export function ActionMoveItem({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionMove>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// Player moving the item must be able to interact with the item
	processingContext.checkCanUseItem(target, action.item, ItemInteractionType.REORDER);

	const { container, itemId } = action.item;
	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	const manipulator = targetManipulator.getContainer(container);

	// Player moving the item must be able to interact with the item after moving it to target position
	// This check happens only if it is being moved in root (otherwise we shouldn't pass insertBeforeRootItem and so it is equivalent to the check above)
	if (action.item.container.length === 0) {
		const items = targetManipulator.getRootItems();
		const currentPos = items.findIndex((item) => item.id === action.item.itemId);
		const newPos = currentPos + action.shift;

		if (newPos < 0 || newPos > items.length)
			return processingContext.invalid();

		processingContext.checkCanUseItem(target, action.item, ItemInteractionType.REORDER, newPos < items.length ? items[newPos].id : undefined);
	}

	// Do change
	if (!manipulator.moveItem(itemId, action.shift))
		return processingContext.invalid();

	// Change message to chat
	// TODO: Message to chat that items were reordered
	// Will need mechanism to rate-limit the messages not to send every reorder

	return processingContext.finalize();
}
