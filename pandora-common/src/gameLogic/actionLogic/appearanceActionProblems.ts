import type { AppearanceValidationError } from '../../assets/appearanceValidation';
import type { ModuleActionData, ModuleActionError, ModuleActionFailure } from '../../assets/modules';
import type { Restriction } from '../../character/restrictionTypes';

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

export type AppearanceActionData =
	| {
		type: 'moduleActionData';
		data: ModuleActionData;
	};
