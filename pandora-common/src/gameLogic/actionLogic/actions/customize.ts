import { produce } from 'immer';
import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { PersonalItemDeploymentAutoDeploySchema } from '../../../assets/item/personal.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { LIMIT_ITEM_DESCRIPTION_LENGTH, LIMIT_ITEM_NAME_LENGTH, LIMIT_ITEM_NAME_PATTERN } from '../../../inputLimits.ts';
import { AssertNotNullable } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

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
	/** Sets whether personal item should auto-deploy to room when put into it. The asset must support room deployment for this to be allowed. */
	personalItemAutoDeploy: PersonalItemDeploymentAutoDeploySchema.optional(),
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

	// To customize deployed room devices, player must have appropriate space role
	if (item.isType('roomDevice') && item.isDeployed()) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveRoomSettings(action.target.type === 'room' ? action.target.roomId : null).roomDeviceDeploymentMinimumRole);
	}

	// Determinate the interaction type(s) based on what is edited
	const isModify = action.requireFreeHandsToUse !== undefined;
	const isCustomize = action.name !== undefined || action.description !== undefined;

	// Player must be able to do the action
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.ACCESS_ONLY);
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

		// Apply the new requireFreeHandsToUse value, if a new value is defined
		if (action.requireFreeHandsToUse !== undefined && (it.isType('personal') || it.isType('roomDevice'))) {
			it = it.customizeFreeHandUsage(action.requireFreeHandsToUse);
		}

		// Apply `personalItemAutoDeploy`
		if (action.personalItemAutoDeploy !== undefined) {
			if (!it.isType('personal') || it.deployment == null)
				return null;

			it = it.withDeployment(produce(it.deployment, (d) => {
				AssertNotNullable(action.personalItemAutoDeploy);
				d.autoDeploy = action.personalItemAutoDeploy;
			}));
		}

		return it;
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
