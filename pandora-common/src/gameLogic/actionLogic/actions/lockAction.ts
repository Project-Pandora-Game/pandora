import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import type { LockItemActionContext } from '../../../assets/item/lock.ts';
import { LockActionSchema } from '../../locks/lockLogic.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionLockAction = z.object({
	type: z.literal('lockAction'),
	/** Target with the lock to interact with */
	target: ActionTargetSelectorSchema,
	/** Path to the lock to interact with */
	item: ItemPathSchema,
	/** The lock action */
	lockAction: LockActionSchema,
});

/** Interacts with a lock (no matter if in inventory or in a lock slot). */
export function ActionLockAction({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionLockAction>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const manipulator = targetManipulator.getContainer(container);

	// Permissions and interaction type are checked by the actual action handler, as they can differ from action to action

	if (!manipulator.modifyItem(itemId, (lock) => {
		if (!lock.isType('lock'))
			return null;

		const actionContext: LockItemActionContext = {
			processingContext,
			target,
			container,
			messageHandler: (m) => {
				processingContext.queueMessage(
					manipulator.makeMessage({
						item: lock.getChatDescriptor(),
						...m,
					}),
				);
			},
			addProblem: (problem) => {
				processingContext.addProblem({
					result: 'moduleActionError',
					reason: problem,
				});
			},
			addData: (data) => {
				processingContext.addData({
					type: 'moduleActionData',
					data,
				});
			},
		};

		return lock.lockAction(actionContext, action.lockAction);
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
