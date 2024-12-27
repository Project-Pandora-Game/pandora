import { freeze } from 'immer';
import type { GameLogicCharacter } from '..';
import { ActionMessageTemplateHandler, ActionTarget, type ActionTargetCharacter } from '../../assets/appearanceTypes';
import { ModuleActionError, ModuleActionFailure, type ModuleActionData } from '../../assets/modules';
import type { AssetFrameworkGlobalState } from '../../assets/state/globalState';
import { CharacterId } from '../../character/characterTypes';
import type { ActionSpaceContext } from '../../space/space';
import { ApplyAction, type AppearanceAction } from './actions/_index';
import { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from './appearanceActionProcessingContext';

export interface AppearanceActionContext {
	player: GameLogicCharacter;
	spaceContext: ActionSpaceContext;
	getCharacter(id: CharacterId): GameLogicCharacter | null;
}

/** Context for performing module actions */
export interface AppearanceModuleActionContext {
	processingContext: AppearanceActionProcessingContext;
	/** The physical target of the action */
	target: ActionTarget;
	/** Character that should be checked for manipulation permissions */
	targetCharacter: ActionTargetCharacter | null;

	messageHandler: ActionMessageTemplateHandler;
	reject: (reason: ModuleActionError) => void;
	failure: (reason: ModuleActionFailure) => void;
	addData: (data: ModuleActionData) => void;
}

/**
 * Do an "immediate" action (the action must have no required slowdown)
 * @param action - The action to perform
 * @param context - Context for the action
 * @param initialState - State before the action
 */
export function DoImmediateAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
): AppearanceActionProcessingResult {
	const processingContext = new AppearanceActionProcessingContext(context, initialState);

	let result = ApplyAction(processingContext, action);

	// The action must have no slowdown, otherwise fail
	if (result.actionSlowdown > 0) {
		result = result.addAdditionalProblems({
			result: 'attemptRequired',
		});
	}

	return result;
}

/**
 * Start an attempt at performing an action
 * @param action - The action to attempt
 * @param context - Context for the action
 * @param initialState - State before the action
 */
export function StartActionAttempt(
	action: AppearanceAction,
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
	currentTime: number,
): AppearanceActionProcessingResult {
	freeze(action, true);

	let slowdown: number;
	// First validate that the action would be possible and fail if it wouldn't with its problems
	{
		const checkContext = new AppearanceActionProcessingContext(context, initialState);
		const checkResult = ApplyAction(checkContext, action);
		if (!checkResult.valid)
			return checkResult;

		slowdown = checkResult.actionSlowdown;
	}

	// Edit the state to start the attempt
	const processingContext = new AppearanceActionProcessingContext(context, initialState);

	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();

	if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) =>
		character.produceWithAttemptedAction({
			action,
			start: currentTime,
			finishAfter: currentTime + (1000 * slowdown),
		}),
	)) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}

