import type { Immutable } from 'immer';
import { z } from 'zod';
import { AssertNever } from '../../../utility';
import type { AppearanceActionProcessingContext } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';
import { ActionAttemptInterrupt, AppearanceActionAttemptInterruptSchema } from './actionAttemptInterrupt';
import { ActionBody, AppearanceActionBody } from './body';
import { ActionColor, AppearanceActionColor } from './color';
import { ActionCreate, AppearanceActionCreateSchema } from './create';
import { ActionAppearanceCustomize, AppearanceActionCustomize } from './customize';
import { ActionDelete, AppearanceActionDeleteSchema } from './delete';
import { ActionModuleAction, AppearanceActionModuleAction } from './moduleAction';
import { ActionMoveItem, AppearanceActionMove } from './move';
import { ActionPose, AppearanceActionPose } from './pose';
import { ActionAppearanceRandomize, AppearanceActionRandomize } from './randomize';
import { ActionRestrictionOverrideChange, AppearanceActionRestrictionOverrideChange } from './restrictionOverrideChange';
import { ActionRoomDeviceDeploy, AppearanceActionRoomDeviceDeploy } from './roomDeviceDeploy';
import { ActionRoomDeviceEnter, AppearanceActionRoomDeviceEnter } from './roomDeviceEnter';
import { ActionRoomDeviceLeave, AppearanceActionRoomDeviceLeave } from './roomDeviceLeave';
import { ActionTransferItem, AppearanceActionTransferSchema } from './transfer';

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionTransferSchema,
	AppearanceActionPose,
	AppearanceActionBody,
	AppearanceActionMove,
	AppearanceActionColor,
	AppearanceActionCustomize,
	AppearanceActionModuleAction,
	AppearanceActionRestrictionOverrideChange,
	AppearanceActionRandomize,
	AppearanceActionRoomDeviceDeploy,
	AppearanceActionRoomDeviceEnter,
	AppearanceActionRoomDeviceLeave,
	AppearanceActionAttemptInterruptSchema,
]);
type AppearanceActionBase = z.infer<typeof AppearanceActionSchema>;

export type AppearanceAction<ActionType extends AppearanceActionBase['type'] = AppearanceActionBase['type']> =
	Extract<AppearanceActionBase, { type: ActionType; }>;

export function ApplyAction(
	processingContext: AppearanceActionProcessingContext,
	action: Immutable<AppearanceAction>,
) {
	const arg: Omit<AppearanceActionHandlerArg, 'action'> = {
		assetManager: processingContext.originalState.assetManager,
		processingContext,
	};

	switch (action.type) {
		case 'create':
			return ActionCreate({ ...arg, action });
		case 'delete':
			return ActionDelete({ ...arg, action });
		case 'transfer':
			return ActionTransferItem({ ...arg, action });
		case 'move':
			return ActionMoveItem({ ...arg, action });
		case 'color':
			return ActionColor({ ...arg, action });
		case 'customize':
			return ActionAppearanceCustomize({ ...arg, action });
		case 'moduleAction':
			return ActionModuleAction({ ...arg, action });
		case 'body':
			return ActionBody({ ...arg, action });
		case 'pose':
			return ActionPose({ ...arg, action });
		case 'restrictionOverrideChange':
			return ActionRestrictionOverrideChange({ ...arg, action });
		case 'randomize':
			return ActionAppearanceRandomize({ ...arg, action });
		case 'roomDeviceDeploy':
			return ActionRoomDeviceDeploy({ ...arg, action });
		case 'roomDeviceEnter':
			return ActionRoomDeviceEnter({ ...arg, action });
		case 'roomDeviceLeave':
			return ActionRoomDeviceLeave({ ...arg, action });
		case 'actionAttemptInterrupt':
			return ActionAttemptInterrupt({ ...arg, action });
		default:
			AssertNever(action);
	}
}
