import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes';
import { ItemInteractionType } from '../../../character/restrictionTypes';
import { LIMIT_ITEM_DESCRIPTION_LENGTH, LIMIT_ITEM_NAME_LENGTH, LIMIT_ITEM_NAME_PATTERN } from '../../../inputLimits';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionCustomize = z.object({
	type: z.literal('customize'),
	/** Target with the item to change */
	target: ActionTargetSelectorSchema,
	/** Path to the item to change */
	item: ItemPathSchema,
	/** New custom name */
	name: z.string().max(LIMIT_ITEM_NAME_LENGTH).regex(LIMIT_ITEM_NAME_PATTERN).optional(),
	/** New description */
	description: z.string().max(LIMIT_ITEM_DESCRIPTION_LENGTH).optional(),
	/** New usage state to require hands to use or not */
	requireFreeHandsToUse: z.boolean().optional(),
});

/** Customizes an item. */
export function ActionAppearanceCustomize({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionCustomize>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	if (target.type === 'character' && target.character.id !== processingContext.player.id) {
		// TODO: change this: only the player can customize their own items for now
		processingContext.addRestriction({ type: 'itemCustomizeOther' });
		return processingContext.invalid();
	}

	const item = target.getItem(action.item);
	// Room device wearable parts cannot be customized
	if (item == null || item.isType('roomDeviceWearablePart')) {
		return processingContext.invalid();
	}

	// To manipulate the style of room devices, player must be an admin
	if (item.isType('roomDevice')) {
		processingContext.checkPlayerIsSpaceAdmin();
	}

	// Player doing the action must be able to interact with the item
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.STYLING);

	const manipulator = processingContext.manipulator.getManipulatorFor(action.target).getContainer(action.item.container);
	if (!manipulator.modifyItem(action.item.itemId, (it) => {
		// Apply name and description
		if (action.name !== undefined) {
			it = it.customizeName(action.name);
		}
		if (action.description !== undefined) {
			it = it.customizeDescription(action.description);
		}

		// Apply the new requireFreeHandsToUse value, if a new value is defined
		if (action.requireFreeHandsToUse !== undefined && (it.isType('personal') || it.isType('roomDevice'))) {
			it = it.customizeFreeHandUsage(action.requireFreeHandsToUse);
		}

		return it;
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
