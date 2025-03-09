import type { AppearanceValidationError } from '../../assets/appearanceValidation';
import type { ModuleActionData, ModuleActionProblem } from '../../assets/modules';
import type { Restriction } from '../../character/restrictionTypes';
import type { CharacterModifierActionError } from '../characterModifiers/characterModifierData';

export type InvalidActionReason = 'noDeleteRoomDeviceWearable' | 'noDeleteDeployedRoomDevice';

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
		result: 'invalidAction';
		reason?: InvalidActionReason;
	}
	| {
		result: 'moduleActionError';
		reason: ModuleActionProblem;
	}
	| {
		result: 'characterModifierActionError';
		reason: CharacterModifierActionError;
	}
	| {
		result: 'restrictionError';
		restriction: Restriction;
	}
	| {
		result: 'validationError';
		validationError: AppearanceValidationError;
	};

export type AppearanceActionData =
	| {
		type: 'moduleActionData';
		data: ModuleActionData;
	};
