import type { Restriction } from '../character/restrictionTypes';
import type { AppearanceValidationError } from './appearanceValidation';
import type { ModuleActionError, ModuleActionFailure } from './modules';

export type AppearanceActionFailure = {
	type: 'moduleActionFailure';
	reason: ModuleActionFailure;
};

export type InvalidActionReason = 'noDeleteRoomDeviceWearable' | 'noDeleteDeployedRoomDevice';

export type AppearanceActionProblem = {
	result: 'failure';
	failure: AppearanceActionFailure;
} | {
	result: 'invalidAction';
	reason?: InvalidActionReason;
} | {
	result: 'moduleActionError';
	reason: ModuleActionError;
} | {
	result: 'restrictionError';
	restriction: Restriction;
} | {
	result: 'validationError';
	validationError: AppearanceValidationError;
};
