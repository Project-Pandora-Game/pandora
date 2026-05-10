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
		case 'moveCharacter':
		case 'pose':
		case 'body':
		case 'moveItem':
		case 'color':
		case 'customize':
		case 'point':
		case 'restrictionOverrideChange':
		case 'randomize':
		case 'roomDeviceDeploy':
		case 'roomDeviceEnter':
		case 'roomDeviceLeave':
		case 'roomConfigure':
		case 'spaceConfigure':
		case 'spaceRoomLayout':
		case 'actionAttemptInterrupt':
		case 'moduleAction':
			break;

		case 'lockAction':
			// Lock and unlock actions should have password hidden
			if (action.lockAction.action === 'lock' || action.lockAction.action === 'unlock') {
				action.lockAction.password = undefined;
			}
			if (action.lockAction.action === 'lock') {
				action.lockAction.timerOptions = undefined;
			}
			break;
		default:
			AssertNever(action);
	}

	return action;
}
