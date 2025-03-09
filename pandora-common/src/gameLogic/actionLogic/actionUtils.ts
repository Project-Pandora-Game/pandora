import type { Immutable } from 'immer';
import { AssertNever, CloneDeepMutable } from '../../utility/index.ts';
import type { AppearanceAction } from './actions/_index.ts';

/**
 * Create a copy of the action with sensitive data removed.
 * @param action - The action to censure.
 * @returns Sanitized action.
 */
export function RedactSensitiveActionData(originalAction: Immutable<AppearanceAction>): AppearanceAction {
	const action: AppearanceAction = CloneDeepMutable(originalAction);

	switch (action.type) {
		case 'create':
		case 'delete':
		case 'transfer':
		case 'pose':
		case 'body':
		case 'move':
		case 'color':
		case 'customize':
		case 'restrictionOverrideChange':
		case 'randomize':
		case 'roomDeviceDeploy':
		case 'roomDeviceEnter':
		case 'roomDeviceLeave':
		case 'actionAttemptInterrupt':
			break;

		case 'moduleAction':
			switch (action.action.moduleType) {
				case 'lockSlot':
					// Lock and unlock actions should have password hidden
					if (action.action.lockAction.action === 'lock' || action.action.lockAction.action === 'unlock') {
						action.action.lockAction.password = undefined;
					}
					if (action.action.lockAction.action === 'lock') {
						action.action.lockAction.timer = undefined;
					}
					break;
			}
			break;
		default:
			AssertNever(action);
	}

	return action;
}
