import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionPoint = z.object({
	type: z.literal('point'),
	/** Target with the item */
	target: ActionTargetSelectorSchema,
	/** Path to the item */
	item: ItemPathSchema,
});

/** Points to an item. */
export function ActionPoint({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionPoint>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const { container, itemId } = action.item;

	// Find the item and its container
	const containerManipulator = processingContext.manipulator.getManipulatorFor(action.target).getContainer(container);
	const item = containerManipulator.getItems().find((i) => i.id === itemId);

	if (item == null)
		return processingContext.invalid();

	// Message to chat
	const manipulatorContainer = containerManipulator.container;
	const isAttached = manipulatorContainer?.contentsPhysicallyEquipped ?? (target.type === 'character');
	processingContext.queueMessage(
		containerManipulator.makeMessage({
			id: isAttached ? 'itemPointAttached' : 'itemPointStored',
			item: item.getChatDescriptor(),
		}),
	);

	return processingContext.finalize();
}
