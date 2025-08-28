import type { Immutable } from 'immer';
import * as z from 'zod';
import { AssertNever } from '../../../utility/index.ts';
import type { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';
import { ActionAttemptInterrupt, AppearanceActionAttemptInterruptSchema } from './actionAttemptInterrupt.ts';
import { ActionBody, AppearanceActionBody } from './body.ts';
import { ActionColor, AppearanceActionColor } from './color.ts';
import { ActionCreate, AppearanceActionCreateSchema } from './create.ts';
import { ActionAppearanceCustomize, AppearanceActionCustomize } from './customize.ts';
import { ActionDelete, AppearanceActionDeleteSchema } from './delete.ts';
import { ActionModuleAction, AppearanceActionModuleAction } from './moduleAction.ts';
import { ActionMoveItem, AppearanceActionMove } from './move.ts';
import { ActionMoveCharacter, AppearanceActionMoveCharacter } from './moveCharacter.ts';
import { ActionPose, AppearanceActionPose } from './pose.ts';
import { ActionAppearanceRandomize, AppearanceActionRandomize } from './randomize.ts';
import { ActionRestrictionOverrideChange, AppearanceActionRestrictionOverrideChange } from './restrictionOverrideChange.ts';
import { ActionRoomConfigure, AppearanceActionRoomConfigure } from './roomConfigure.ts';
import { ActionRoomDeviceDeploy, AppearanceActionRoomDeviceDeploy } from './roomDeviceDeploy.ts';
import { ActionRoomDeviceEnter, AppearanceActionRoomDeviceEnter } from './roomDeviceEnter.ts';
import { ActionRoomDeviceLeave, AppearanceActionRoomDeviceLeave } from './roomDeviceLeave.ts';
import { ActionSpaceRoomLayout, AppearanceActionSpaceRoomLayout } from './spaceRoomLayout.ts';
import { ActionTransferItem, AppearanceActionTransferSchema } from './transfer.ts';

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionTransferSchema,
	AppearanceActionMoveCharacter,
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
	AppearanceActionRoomConfigure,
	AppearanceActionSpaceRoomLayout,
	AppearanceActionAttemptInterruptSchema,
]);
type AppearanceActionBase = z.infer<typeof AppearanceActionSchema>;

export type AppearanceActionType = AppearanceActionBase['type'];
export type AppearanceAction<ActionType extends AppearanceActionType = AppearanceActionType> =
	Extract<AppearanceActionBase, { type: ActionType; }>;

/** List of appearance actions that cannot be affected by character modifiers or other scripting mechanisms. */
export const PROTECTED_APPEARANCE_ACTIONS = {
	restrictionOverrideChange: true,
} as const satisfies Readonly<Partial<Record<AppearanceActionType, true>>>;
export type ProtectedAppearanceActionType = keyof typeof PROTECTED_APPEARANCE_ACTIONS;

export function IsProtectedAppearanceAction(type: AppearanceActionType): type is ProtectedAppearanceActionType {
	return (PROTECTED_APPEARANCE_ACTIONS as Readonly<Partial<Record<AppearanceActionType, true>>>)[type] === true;
}

/** Apply appearance action to a processing context, without any additional checks or logic on top. */
function ApplyActionBase(
	processingContext: AppearanceActionProcessingContext,
	action: Immutable<AppearanceAction>,
): AppearanceActionProcessingResult {
	const arg: Omit<AppearanceActionHandlerArg, 'action'> = {
		assetManager: processingContext.originalState.assetManager,
		processingContext,
	};

	processingContext.addPerformedAction(action);

	switch (action.type) {
		case 'create':
			return ActionCreate({ ...arg, action });
		case 'delete':
			return ActionDelete({ ...arg, action });
		case 'transfer':
			return ActionTransferItem({ ...arg, action });
		case 'moveCharacter':
			return ActionMoveCharacter({ ...arg, action });
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
		case 'roomConfigure':
			return ActionRoomConfigure({ ...arg, action });
		case 'spaceRoomLayout':
			return ActionSpaceRoomLayout({ ...arg, action });
		case 'actionAttemptInterrupt':
			return ActionAttemptInterrupt({ ...arg, action });
		default:
			AssertNever(action);
	}
}

/**
 * Apply an action onto a processing context, running action-specific checks and "smart" behavior on top.
 * @param processingContext - The processing context to work with
 * @param action - The action to apply
 * @returns - Result of the action
 */
export function ApplyAction(
	processingContext: AppearanceActionProcessingContext,
	action: Immutable<AppearanceAction>,
): AppearanceActionProcessingResult {
	// We get modifier effects _before_ the action is performed
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
	const modifierEffects = playerRestrictionManager.getModifierEffectProperties();

	let result = ApplyActionBase(processingContext, action);

	// If the action by itself is valid, then check it against character modifiers of the source character
	// (unless this is a "protected" action)
	if (!IsProtectedAppearanceAction(action.type) && result.valid) {
		const originalResult = result;
		for (const modifier of modifierEffects) {
			if (modifier.checkCharacterAction != null) {
				const checkResult = modifier.checkCharacterAction(action, playerRestrictionManager, originalResult);
				if (checkResult === 'allow') {
					// Noop
				} else if (checkResult === 'block') {
					result = result.addAdditionalProblems({
						result: 'restrictionError',
						restriction: {
							type: 'blockedByCharacterModifier',
							modifierId: modifier.effect.id,
							modifierType: modifier.effect.type,
						},
					});
				} else if (checkResult.result === 'slow') {
					result = result.addAdditionalSlowdown(checkResult.milliseconds);
				} else {
					AssertNever(checkResult.result);
				}
			}
		}
	}

	return result;
}
