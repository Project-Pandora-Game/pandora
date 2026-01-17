import { produce } from 'immer';
import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { RoomPositionSchema } from '../../../assets/state/roomGeometry.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { CloneDeepMutable } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

/** Move an item within its container */
export const AppearanceActionMoveItem = z.object({
	type: z.literal('moveItem'),
	/** Target with the item to move */
	target: ActionTargetSelectorSchema,
	/** Path to the item to move */
	item: ItemPathSchema,
	/** Relative shift for the item inside its container. If not set, defaults to zero. */
	shift: z.number().int().optional(),
	/** Sets personal item deployment. Only allowed if the item is currently in the room inventory and the asset allows room deployments. */
	personalItemDeployment: z.object({
		deployed: z.boolean().optional(),
		position: RoomPositionSchema.optional(),
	}).optional(),
});

/** Moves an item within inventory, reordering the worn order. */
export function ActionMoveItem({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionMoveItem>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const shift = action.shift ?? 0;

	// Player moving the item must be able to interact with the item
	processingContext.checkCanUseItem(target, action.item, shift !== 0 ? ItemInteractionType.REORDER : ItemInteractionType.ACCESS_ONLY);

	const { container, itemId } = action.item;
	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	const manipulator = targetManipulator.getContainer(container);

	// Player moving the item must be able to interact with the item after moving it to target position
	// This check happens only if it is being moved in root (otherwise we shouldn't pass insertBeforeRootItem and so it is equivalent to the check above)
	if (shift !== 0 && action.item.container.length === 0) {
		const items = targetManipulator.getRootItems();
		const currentPos = items.findIndex((item) => item.id === action.item.itemId);
		const newPos = currentPos + shift;

		if (newPos < 0 || newPos > items.length)
			return processingContext.invalid();

		processingContext.checkCanUseItem(target, action.item, ItemInteractionType.REORDER, newPos < items.length ? items[newPos].id : undefined);
	}

	// If deployment is being changed, modify the item
	if (action.personalItemDeployment !== undefined) {

		if (!manipulator.modifyItem(itemId, (it) => {
			if (!it.isType('personal') || it.deployment == null)
				return null;

			return it.withDeployment(produce(it.deployment, (d) => {
				if (action.personalItemDeployment?.deployed != null) {
					d.deployed = action.personalItemDeployment.deployed;
				}
				if (action.personalItemDeployment?.position != null) {
					d.position = CloneDeepMutable(action.personalItemDeployment.position);
				}
			}));
		})) {
			return processingContext.invalid();
		}
	}

	// Do the reorder change
	if (shift !== 0) {
		if (!manipulator.moveItem(itemId, shift))
			return processingContext.invalid();
	}

	// Change message to chat
	// TODO: Message to chat that items were reordered
	// Will need mechanism to rate-limit the messages not to send every reorder

	return processingContext.finalize();
}
