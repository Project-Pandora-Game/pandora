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

export function DoAppearanceAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
): AppearanceActionProcessingResult {
	const processingContext = new AppearanceActionProcessingContext(context, initialState);

	return ApplyAction(processingContext, action);
}
