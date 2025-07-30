import type { AppearanceValidationError } from '../../assets/appearanceValidation.ts';
import type { ModuleActionData, ModuleActionProblem } from '../../assets/modules.ts';
import type { Restriction } from '../../character/restrictionTypes.ts';
import type { CharacterModifierActionError } from '../characterModifiers/characterModifierData.ts';

export type InvalidActionReason = 'noDeleteRoomDeviceWearable' | 'noDeleteDeployedRoomDevice' | 'characterMoveCannotFollowTarget';

export type AppearanceActionProblem =
	| {
		// The action requires an attempt to be started and later finished due to a slowdown.
		result: 'attemptRequired';
	}
	| {
		// This action might be valid, but not at this point in time.
		// Example is attempting to finish an action that takes longer than from when it was started.
		result: 'tooSoon';
	}
	| {
		// Something went wrong while processing the action.
		// Invalid or missing reference is the most common reason, but it could also include actions that are simply impossible.
		result: 'invalidAction';
		reason?: InvalidActionReason;
	}
	| {
		// Interaction with item module failed. More specific problems are described by individual module types.
		result: 'moduleActionError';
		reason: ModuleActionProblem;
	}
	| {
		// Character modifier prevented the action. Reason is specific to a modifier type.
		result: 'characterModifierActionError';
		reason: CharacterModifierActionError;
	}
	| {
		// While the action is valid, the player is not permitted to perform the action.
		result: 'restrictionError';
		restriction: Restriction;
	}
	| {
		// The action itself is valid, but resulting state is invalid (unsatisfied requirement, conflict, ...)
		result: 'validationError';
		validationError: AppearanceValidationError;
	};

export type AppearanceActionData =
	| {
		type: 'moduleActionData';
		data: ModuleActionData;
	};
