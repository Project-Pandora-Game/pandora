import { freeze, type Immutable } from 'immer';
import type { GameLogicCharacter } from '..';
import type { CharacterActionAttempt, Item, ItemContainerPath } from '../../assets';
import { ActionMessageTemplateHandler, ActionTarget, type ActionTargetCharacter } from '../../assets/appearanceTypes';
import { ModuleActionError, ModuleActionFailure, type ModuleActionData } from '../../assets/modules';
import type { AssetFrameworkGlobalState } from '../../assets/state/globalState';
import { CharacterId } from '../../character/characterTypes';
import type { ActionSpaceContext } from '../../space/space';
import { ApplyAction, type AppearanceAction } from './actions/_index';
import { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from './appearanceActionProcessingContext';

export interface AppearanceActionContext {
	/**
	 * What is the reason for running this action. Can cause some checks to be skipped.
	 * - `act` = This is a full action that will result in changes. All checks are performed.
	 * - `clientOnlyVerify` = This is a pre-check on client and some bits can be skipped (especially those opaque to client).
	 */
	executionContext: 'act' | 'clientOnlyVerify';
	player: GameLogicCharacter;
	spaceContext: ActionSpaceContext;
	getCharacter(id: CharacterId): GameLogicCharacter | null;
}

/** Context for performing module actions */
export interface AppearanceModuleActionContext {
	processingContext: AppearanceActionProcessingContext;
	/** The physical target of the action */
	target: ActionTarget;
	/** The path to the module on which the action is being performed */
	module: ItemContainerPath;
	/** The item the action is being performed on */
	item: Item;
	/** The name of the module the action is being performed on */
	moduleName: string;
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
	if (result.getActionSlowdownTime() > 0) {
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
 * @param currentTime - Current time (timestamp)
 */
export function StartActionAttempt(
	action: Immutable<AppearanceAction>,
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
	currentTime: number,
): AppearanceActionProcessingResult {
	freeze(action, true);

	let slowdown: number;
	// First validate that the action would be possible and fail if it wouldn't with its problems
	{
		// We do a client-only verify when starting action to delay things like password checks until the action is actually performed
		const checkContext = new AppearanceActionProcessingContext({
			...context,
			executionContext: 'clientOnlyVerify',
		}, initialState);
		const checkResult = ApplyAction(checkContext, action);
		if (!checkResult.valid)
			return checkResult;

		slowdown = checkResult.getActionSlowdownTime();
	}

	// Edit the state to start the attempt
	const processingContext = new AppearanceActionProcessingContext(context, initialState);

	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();

	if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) =>
		character.produceWithAttemptedAction({
			action,
			start: currentTime,
			finishAfter: currentTime + slowdown,
		}),
	)) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}

/**
 * Finish an attempt at performing an action
 * @param context - Context for the action
 * @param initialState - State before the action
 * @param currentTime - Current time (timestamp)
 */
export function FinishActionAttempt(
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
	currentTime: number,
): AppearanceActionProcessingResult {
	const processingContext = new AppearanceActionProcessingContext(context, initialState);
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();

	// Get and clear the current action the user is performing
	let attempt: undefined | Immutable<CharacterActionAttempt>;

	if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) => {
		attempt = character.attemptingAction ?? undefined;

		return character.produceWithAttemptedAction(null);
	})) {
		return processingContext.invalid();
	}

	// There must be an action in progress
	if (attempt == null)
		return processingContext.invalid();

	// We must be allowed to finish the action
	if (attempt.finishAfter > currentTime) {
		processingContext.addProblem({ result: 'tooSoon' });
	}

	// Perform the action now, checking if it still is valid
	const result = ApplyAction(processingContext, attempt.action);

	// Note: We intentionally ignore the possibility of slowdown having increased since the action start,
	// as that could easily be annoying for the user.

	return result;
}

/**
 * Abort an attempt at performing an action
 * @param context - Context for the action
 * @param initialState - State before the action
 */
export function AbortActionAttempt(
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
): AppearanceActionProcessingResult {
	const processingContext = new AppearanceActionProcessingContext(context, initialState);

	// Clear the current action the user is performing
	if (!processingContext.manipulator.produceCharacterState(processingContext.player.id, (character) => {
		return character.produceWithAttemptedAction(null);
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
