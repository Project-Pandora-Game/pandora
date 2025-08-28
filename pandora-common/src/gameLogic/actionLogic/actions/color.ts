import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { ItemColorBundleSchema } from '../../../assets/item/base.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionColor = z.object({
	type: z.literal('color'),
	/** Target with the item to color */
	target: ActionTargetSelectorSchema,
	/** Path to the item to color */
	item: ItemPathSchema,
	/** The new color to set */
	color: ItemColorBundleSchema,
});

/** Changes the color of an item. */
export function ActionColor({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionColor>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();
	const item = target.getItem(action.item);
	// To manipulate the color of room devices, player must be an admin
	if (item?.isType('roomDevice')) {
		processingContext.checkPlayerIsSpaceAdmin();
	}
	// Player coloring the item must be able to interact with the item
	processingContext.checkCanUseItem(target, action.item, ItemInteractionType.STYLING);

	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const manipulator = targetManipulator.getContainer(container);

	// Do change
	if (!manipulator.modifyItem(itemId, (it) => it.changeColor(action.color)))
		return processingContext.invalid();

	// Change message to chat
	// TODO: Message to chat that item was colored
	// Will need mechanism to rate-limit the messages not to send every color change

	return processingContext.finalize();
}
