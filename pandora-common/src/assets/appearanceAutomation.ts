import { AssertNever } from '../utility';
import type { AppearanceRootManipulator } from './appearanceHelpers';
import type { ItemModuleAction } from './modules';

interface AppearanceAutomaticActionBase<T extends string> {
	type: T;
	/**
	 * Failure mode for this action. Possible values are:
	 * - `required`: Must apply to at least one item and all invocations must succeed
	 * - `optional`: All invocations must succeed, but not doing anything is valid result
	 * - `ignorable`: Doesn't matter if it does something or not or even if it tries and fails
	 */
	mode: 'required' | 'optional' | 'ignorable';
}

interface AppearanceAutomaticActionSetExpression extends AppearanceAutomaticActionBase<'setExpression'> {
	/** Exact name of the expression to modify */
	expression: string;
	/** Module-action to do on the expression module */
	action: ItemModuleAction;
}

function AssetAutomationRunSetExpression(
	manipulator: AppearanceRootManipulator,
	{ mode, expression, action }: AppearanceAutomaticActionSetExpression,
): boolean {
	let match = false;
	for (const item of manipulator.getItems()) {
		for (const [moduleName, module] of item.modules) {
			if (module.config.expression === expression) {
				match = true;
				if (
					!manipulator.modifyItem(item.id, (it) => it.moduleAction(
						moduleName,
						action,
						(m) => manipulator.queueMessage({
							item: {
								assetId: it.asset.id,
							},
							...m,
						}),
					)) &&
					mode !== 'ignorable'
				) {
					return false;
				}
			}
		}
	}
	return mode === 'required' ? match : true;
}

export type AppearanceAutomaticAction =
	| AppearanceAutomaticActionSetExpression;

/** Actions that get run on specific asset interactions, meant to make using items easier, like automating some prerequisites */
export interface AssetAutomaticActions {
	/** Actions run before the item is added */
	beforeAdd?: AppearanceAutomaticAction[];
	/** Actions run after the item is removed (before validation happens) */
	afterRemove?: AppearanceAutomaticAction[];
}

export type AssetAutomationEvent = (keyof AssetAutomaticActions) & string;

export function AssetAutomationRun(manipulator: AppearanceRootManipulator, automation: AppearanceAutomaticAction[] | undefined): boolean {
	if (!automation)
		return true;

	for (const action of automation) {
		switch (action.type) {
			case 'setExpression':
				if (!AssetAutomationRunSetExpression(manipulator, action))
					return false;
				break;
			default:
				AssertNever(action.type);
		}
	}

	return true;
}
