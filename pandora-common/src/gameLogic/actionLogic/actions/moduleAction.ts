import { z } from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes';
import { ItemModuleActionSchema, type ModuleActionError } from '../../../assets/modules';
import { Assert } from '../../../utility';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionModuleAction = z.object({
	type: z.literal('moduleAction'),
	/** Target with the item to color */
	target: ActionTargetSelectorSchema,
	/** Path to the item to interact with */
	item: ItemPathSchema,
	/** The module to interact with */
	module: z.string(),
	/** Action to do on the module */
	action: ItemModuleActionSchema,
});

/** Perform module-specific action. */
export function ActionModuleAction({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionModuleAction>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const item = target.getItem(action.item);
	if (!item)
		return processingContext.invalid();

	// Player doing the action must be able to interact with the item
	processingContext.checkCanUseItemModule(target, action.item, action.module, item.moduleActionGetInteractionType(action.module, action.action));

	const rootManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const containerManipulator = rootManipulator.getContainer(container);

	let rejectionReason: ModuleActionError | undefined;

	const targetCharacter = processingContext.resolveTargetCharacter(target, [...container, { item: itemId, module: action.module }]);
	Assert(target.type !== 'character' || target === targetCharacter);

	// Do change and store chat messages
	if (!containerManipulator.modifyItem(itemId, (it) => {
		const actionContext: AppearanceModuleActionContext = {
			processingContext,
			target,
			targetCharacter,
			module: [
				...container,
				{
					item: itemId,
					module: action.module,
				},
			],
			item: it,
			moduleName: action.module,
			messageHandler: (m) => {
				processingContext.queueMessage(
					containerManipulator.makeMessage({
						item: {
							assetId: it.asset.id,
							itemName: it.name ?? '',
						},
						...m,
					}),
				);
			},
			reject: (reason) => {
				rejectionReason ??= reason;
			},
			failure: (reason) => {
				processingContext.addProblem({
					result: 'failure',
					failure: {
						type: 'moduleActionFailure',
						reason,
					},
				});
			},
			addData: (data) => {
				processingContext.addData({
					type: 'moduleActionData',
					data,
				});
			},
		};

		return it.moduleAction(
			actionContext,
			action.module,
			action.action,
		);
	}) || rejectionReason) {
		processingContext.addProblem({
			result: 'moduleActionError',
			reason: rejectionReason ?? { type: 'invalid' },
		});
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
