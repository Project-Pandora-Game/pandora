import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemContainerPathSchema } from '../../../assets/appearanceTypes.ts';
import type { AppearanceItems } from '../../../assets/index.ts';
import { ItemIdSchema, type ItemId } from '../../../assets/item/base.ts';
import { ItemTemplateSchema } from '../../../assets/item/unified.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { Assert } from '../../../utility/index.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionCreateSchema = z.object({
	type: z.literal('create'),
	/** Template describing an item configuration for creating the new item */
	itemTemplate: ItemTemplateSchema,
	/** Target the item should be added to after creation */
	target: ActionTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
	/** Item to insert the new one in front of in the target container */
	insertBefore: ItemIdSchema.optional(),
});

/** Create and equip an item. */
export function ActionCreate({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionCreateSchema>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const item = assetManager.createItemFromTemplate(action.itemTemplate, processingContext.player);
	if (item == null)
		return processingContext.invalid();

	// Player must be allowed to spawn this item
	processingContext.getPlayerRestrictionManager()
		.checkSpawnItem(processingContext, item);

	// Player adding the item must be able to use it
	processingContext.checkCanUseItemDirect(
		target,
		action.container,
		item,
		ItemInteractionType.ADD_REMOVE,
		action.container.length === 0 ? action.insertBefore : undefined,
	);

	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	if (!targetManipulator)
		return processingContext.invalid();

	const insertBefore: ItemId | null = action.insertBefore ?? null;
	const manipulator = targetManipulator.getContainer(action.container);

	// Do change
	let removed: AppearanceItems = [];
	// if this is a bodypart not allowing multiple do a swap instead, but only in root
	if (manipulator.isCharacter() &&
		item.isType('bodypart') &&
		manipulator.assetManager.bodyparts.find((bp) => bp.name === item.asset.definition.bodypart)?.allowMultiple === false
	) {
		removed = manipulator.removeMatchingItems((oldItem) => oldItem.isType('bodypart') &&
			oldItem.asset.definition.bodypart === item.asset.definition.bodypart,
		);
	}

	let targetIndex: number | undefined;
	if (insertBefore != null) {
		targetIndex = manipulator.getItems().findIndex((anchor) => anchor.id === insertBefore);
		if (targetIndex < 0)
			return processingContext.invalid();
	}

	if (!manipulator.addItem(item, targetIndex))
		return processingContext.invalid();

	// if this is a bodypart, we sort bodyparts to be valid, to be more friendly
	if (manipulator.isCharacter() &&
		item.isType('bodypart')
	) {
		if (!manipulator.fixBodypartOrder())
			return processingContext.invalid();
	}

	// Change message to chat
	if (removed.length > 0) {
		Assert(targetManipulator.isCharacter());
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: 'itemReplace',
				item: item.getChatDescriptor(),
				itemPrevious: removed[0].getChatDescriptor(),
			}),
		);
	} else {
		const manipulatorContainer = manipulator.container;
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: (!manipulatorContainer && targetManipulator.isCharacter()) ? 'itemAddCreate' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
				item: item.getChatDescriptor(),
			}),
		);
	}

	return processingContext.finalize();
}
