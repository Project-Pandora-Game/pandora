import { isEqual } from 'lodash';
import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemContainerPathSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { ItemIdSchema, type ItemId } from '../../../assets/item/base.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

/** Action that moves item between two containers (e.g. character and character or character and room inventory or character and bag the charater is wearing) */
export const AppearanceActionTransferSchema = z.object({
	type: z.literal('transfer'),
	/** Target with the item to get */
	source: ActionTargetSelectorSchema,
	/** Path to the item */
	item: ItemPathSchema,
	/** Target the item should be added to after removing it from original place */
	target: ActionTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
	/** Item to insert the current one in front of in the target container */
	insertBefore: ItemIdSchema.optional(),
});

/** Unequip item and equip on another target. */
export function ActionTransferItem({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionTransferSchema>>): AppearanceActionProcessingResult {
	const source = processingContext.getTarget(action.source);
	const target = processingContext.getTarget(action.target);
	if (!source || !target)
		return processingContext.invalid();

	const { container, itemId } = action.item;
	const targetContainer = action.container;
	const insertBefore: ItemId | null = action.insertBefore ?? null;

	// Preform the transfer in manipulators
	const sourceManipulator = processingContext.manipulator.getManipulatorFor(action.source);
	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const sourceContainerManipulator = sourceManipulator.getContainer(container);
	const targetContainerManipulator = targetManipulator.getContainer(targetContainer);

	// If the source and target container are the same, the action is only a reorder and has lesser requirements
	const isReorder = isEqual(sourceManipulator.target, targetManipulator.target) && isEqual(container, targetContainer);
	const interactionType: ItemInteractionType = isReorder ? ItemInteractionType.REORDER : ItemInteractionType.ADD_REMOVE;

	// Player removing the item must be able to use it on source
	processingContext.checkCanUseItem(source, action.item, interactionType);

	// Remove from original location
	const removedItems = sourceContainerManipulator.removeMatchingItems((i) => i.id === itemId);

	if (removedItems.length !== 1)
		return processingContext.invalid();

	const item = removedItems[0];

	// Player adding the item must be able to use it on target
	processingContext.checkCanUseItemDirect(
		target,
		action.container,
		item,
		interactionType,
		action.container.length === 0 ? action.insertBefore : undefined,
	);

	// Check if item allows being transferred
	if (!item.canBeTransferred()) {
		// If not, then check this is actually a transfer (moving not between targets nor containers is fine, as then it is essentially a move)
		if (!isReorder) {
			return processingContext.invalid();
		}
	}

	let targetIndex: number | undefined;
	if (insertBefore != null) {
		targetIndex = targetContainerManipulator.getItems().findIndex((anchor) => anchor.id === insertBefore);
		if (targetIndex < 0)
			return processingContext.invalid();
	}

	if (!targetContainerManipulator.addItem(item, targetIndex))
		return processingContext.invalid();

	// Change message to chat
	if (sourceManipulator.isCharacter() && (!targetManipulator.isCharacter() || sourceManipulator.characterId !== targetManipulator.characterId)) {
		const manipulatorContainer = sourceContainerManipulator.container;
		processingContext.queueMessage(
			sourceContainerManipulator.makeMessage({
				id: !manipulatorContainer ? 'itemRemove' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
				item: item.getChatDescriptor(),
			}),
		);
	}
	if (targetManipulator.isCharacter() && (!sourceManipulator.isCharacter() || targetManipulator.characterId !== sourceManipulator.characterId)) {
		const manipulatorContainer = targetContainerManipulator.container;
		processingContext.queueMessage(
			targetContainerManipulator.makeMessage({
				id: !manipulatorContainer ? 'itemAdd' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
				item: removedItems[0].getChatDescriptor(),
			}),
		);
	}

	return processingContext.finalize();
}
