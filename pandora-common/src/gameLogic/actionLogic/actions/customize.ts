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
	/** Chat specific entries */
	chat: z.object({
		/** New generic name */
		generic: z.string().max(LIMIT_ITEM_NAME_LENGTH).regex(LIMIT_ITEM_NAME_PATTERN),
		/** New specific name */
		specific: z.string().max(LIMIT_ITEM_NAME_LENGTH).regex(LIMIT_ITEM_NAME_PATTERN),
	}),
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

	const item = target.getItem(action.item);
	// Room device wearable parts cannot be customized
	if (item == null || item.isType('roomDeviceWearablePart')) {
		return processingContext.invalid();
	}

	// To customize deployed room devices, player must be an admin
	if (item.isType('roomDevice') && item.isDeployed()) {
		processingContext.checkPlayerIsSpaceAdmin();
	}

	// Determinate the interaction type(s) based on what is edited
	const isModify = action.requireFreeHandsToUse !== undefined;
	const isCustomize = action.name !== undefined || action.description !== undefined;

	// Player must be able to do the action
	if (isModify) {
		processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.MODIFY);
	}
	if (isCustomize) {
		processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.CUSTOMIZE);
	}
	// Changing the "requireFreeHandsToUse" specially requires free hands
	// (no changing something that affects how blocked hands behave, while you have blocked hands)
	if (action.requireFreeHandsToUse !== undefined) {
		processingContext.getPlayerRestrictionManager()
			.checkUseHands(processingContext, false);
	}

	const manipulator = processingContext.manipulator.getManipulatorFor(action.target).getContainer(action.item.container);
	if (!manipulator.modifyItem(action.item.itemId, (it) => {
		// Apply name and description
		if (action.name !== undefined) {
			it = it.customizeName(action.name);
		}
		if (action.description !== undefined) {
			it = it.customizeDescription(action.description);
		}
		if ((action.chat?.generic !== undefined) || (action.chat?.specific !== undefined)) {
			it = it.customizeChat(action.chat);
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
