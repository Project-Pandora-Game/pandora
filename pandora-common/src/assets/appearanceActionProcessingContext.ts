import { isEqual } from 'lodash';
import { CharacterId, CharacterRestrictionsManager } from '../character';
import { GameLogicCharacter, GameLogicPermission, InteractionId } from '../gameLogic';
import { Assert, AssertNever, AssertNotNullable } from '../utility';
import { AppearanceActionProblem, InvalidActionReason } from './appearanceActionProblems';
import { AppearanceActionContext } from './appearanceActions';
import { ActionHandlerMessage, ActionHandlerMessageWithTarget, RoomActionTarget, RoomTargetSelector } from './appearanceTypes';
import { AssetFrameworkGlobalStateManipulator } from './manipulators/globalStateManipulator';
import { RoomInventory } from './roomInventory';
import { AssetFrameworkGlobalState } from './state/globalState';

export class AppearanceActionProcessingContext {
	private readonly _context: AppearanceActionContext;

	public get player(): GameLogicCharacter {
		return this._context.player;
	}

	public readonly originalState: AssetFrameworkGlobalState;

	public readonly manipulator: AssetFrameworkGlobalStateManipulator;

	private _pendingMessages: ActionHandlerMessage[] = [];
	public get pendingMessages(): readonly ActionHandlerMessage[] {
		return this._pendingMessages;
	}

	private readonly _actionProblems: AppearanceActionProblem[] = [];
	public get actionProblems(): readonly AppearanceActionProblem[] {
		return this._actionProblems;
	}

	private readonly _requiredPermissions = new Set<GameLogicPermission>();
	public get requiredPermissions(): ReadonlySet<GameLogicPermission> {
		return this._requiredPermissions;
	}

	constructor(context: AppearanceActionContext) {
		this._context = context;
		this.originalState = context.globalState.currentState;

		this.manipulator = new AssetFrameworkGlobalStateManipulator(this.originalState);
	}

	public getPlayerRestrictionManager(): CharacterRestrictionsManager {
		const playerRestrictionManager = this.getCharacter(this.player.id);
		AssertNotNullable(playerRestrictionManager);
		return playerRestrictionManager;
	}

	public getCharacter(id: CharacterId): CharacterRestrictionsManager | null {
		const char = this._context.getCharacter(id);
		const charState = this.manipulator.currentState.getCharacterState(id);
		Assert((char == null) === (charState == null));

		if (char == null || charState == null)
			return null;

		return char.getRestrictionManager(charState, this._context.roomContext);
	}

	public getTarget(target: RoomTargetSelector): RoomActionTarget | null {
		if (target.type === 'character') {
			const char = this._context.getCharacter(target.characterId);
			const charState = this.manipulator.currentState.getCharacterState(target.characterId);
			Assert((char == null) === (charState == null));

			if (char == null || charState == null)
				return null;

			return char.getAppearance(charState);
		}

		if (target.type === 'roomInventory') {
			const state = this.manipulator.currentState.room;
			return state != null ? new RoomInventory(state) : null;
		}

		AssertNever(target);
	}

	public queueMessage(message: ActionHandlerMessageWithTarget): void {
		this._pendingMessages.push({
			...message,
			character: {
				type: 'character',
				id: this.player.id,
			},
		});
	}

	public addProblem(problem: AppearanceActionProblem): void {
		// Avoid adding duplicate problems
		if (this._actionProblems.some((existingProblem) => isEqual(existingProblem, problem)))
			return;

		this._actionProblems.push(problem);
	}

	public addInteraction(target: GameLogicCharacter, interaction: InteractionId): void {
		// Player doing action on themselves is not an interaction
		if (target.id === this.player.id)
			return;

		// Check the permission for the interaction
		this.addRequiredPermission(
			target.interactions.getInteractionPermission(interaction),
		);
	}

	public addRequiredPermission(permission: GameLogicPermission): void {
		// Player has all the permissions towards themselves
		if (permission.character.id === this.player.id)
			return;

		this._requiredPermissions.add(permission);

		// Check the permission
		if (!permission.checkPermission(this.player)) {
			this.addProblem({
				result: 'restrictionError',
				restriction: permission.getRestrictionDescriptor(),
			});
		}
	}

	public invalid(invalidReason?: InvalidActionReason): AppearanceActionProcessingResultInvalid {
		return new AppearanceActionProcessingResultInvalid(this, invalidReason);
	}

	public finalize(): AppearanceActionProcessingResultValid {
		return new AppearanceActionProcessingResultValid(this, this.manipulator.currentState);
	}
}

abstract class AppearanceActionProcessingResultBase {
	public readonly originalState: AssetFrameworkGlobalState;

	public abstract readonly problems: readonly AppearanceActionProblem[];

	public readonly requiredPermissions: ReadonlySet<GameLogicPermission>;

	constructor(processingContext: AppearanceActionProcessingContext) {
		this.originalState = processingContext.originalState;
		this.requiredPermissions = processingContext.requiredPermissions;
	}
}

export class AppearanceActionProcessingResultInvalid extends AppearanceActionProcessingResultBase {
	public readonly valid = false;

	public readonly problems: readonly AppearanceActionProblem[];

	constructor(processingContext: AppearanceActionProcessingContext, invalidReason?: InvalidActionReason) {
		super(processingContext);
		this.problems = [
			...processingContext.actionProblems,
			{
				result: 'invalidAction',
				reason: invalidReason,
			},
		];
	}
}

export class AppearanceActionProcessingResultValid extends AppearanceActionProcessingResultBase {
	public readonly valid = true;

	public readonly problems: readonly AppearanceActionProblem[];
	public readonly resultState: AssetFrameworkGlobalState;
	public readonly pendingMessages: readonly ActionHandlerMessage[];

	constructor(processingContext: AppearanceActionProcessingContext, resultState: AssetFrameworkGlobalState) {
		super(processingContext);
		this.resultState = resultState;
		this.pendingMessages = processingContext.pendingMessages;

		{
			// Final validations of result
			const problems: AppearanceActionProblem[] = [
				...processingContext.actionProblems,
			];

			// Validate result state
			const validationResult = resultState.validate();
			if (!validationResult.success) {
				problems.push({
					result: 'validationError',
					validationError: validationResult.error,
				});
			}

			this.problems = problems;
		}
	}
}

export type AppearanceActionProcessingResult = AppearanceActionProcessingResultValid | AppearanceActionProcessingResultInvalid;
