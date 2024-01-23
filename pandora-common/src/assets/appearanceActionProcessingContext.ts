import { isEqual, uniqWith } from 'lodash';
import type { CharacterId, CharacterRestrictionsManager, ItemInteractionType, RestrictionResult } from '../character';
import type { GameLogicCharacter, GameLogicPermission, InteractionId } from '../gameLogic';
import { Assert, AssertNever, AssertNotNullable } from '../utility';
import type { AppearanceActionProblem, InvalidActionReason } from './appearanceActionProblems';
import type { AppearanceActionContext } from './appearanceActions';
import type { ActionHandlerMessage, ActionHandlerMessageWithTarget, ActionTarget, ActionTargetSelector, ItemContainerPath, ItemId, ItemPath } from './appearanceTypes';
import { AssetFrameworkGlobalStateManipulator } from './manipulators/globalStateManipulator';
import { RoomInventory } from './roomInventory';
import type { AssetFrameworkGlobalState } from './state/globalState';
import type { Item } from './item';

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

		return char.getRestrictionManager(charState, this._context.spaceContext);
	}

	public getTarget(target: ActionTargetSelector): ActionTarget | null {
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

	public addRequiredPermission(permission: GameLogicPermission | null): void {
		// Player has all the permissions towards themselves
		if (permission == null || permission.character.id === this.player.id)
			return;

		this._requiredPermissions.add(permission);

		// Check the permission
		const result = permission.checkPermission(this.player);
		if (result === 'yes')
			return;

		this.addProblem({
			result: 'restrictionError',
			restriction: permission.getRestrictionDescriptor(result),
		});
	}

	public checkPlayerIsSpaceAdmin(): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		if (!restrictionManager.isCurrentSpaceAdmin()) {
			this.addProblem({
				result: 'restrictionError',
				restriction: {
					type: 'modifyRoomRestriction',
					reason: 'notAdmin',
				},
			});
		}
	}

	public checkInteractWithTarget(target: ActionTarget): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestriction(restrictionManager.canInteractWithTarget(this, target));
	}

	public checkCanUseItem(target: ActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestriction(restrictionManager.canUseItem(this, target, itemPath, interaction, insertBeforeRootItem));
	}

	public checkCanUseItemDirect(target: ActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestriction(restrictionManager.canUseItemDirect(this, target, container, item, interaction, insertBeforeRootItem));
	}

	public checkCanUseItemModule(target: ActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestriction(restrictionManager.canUseItemModule(this, target, itemPath, moduleName, interaction));
	}

	private addRestriction(result: RestrictionResult): void {
		if (!result.allowed) {
			this.addProblem({
				result: 'restrictionError',
				restriction: result.restriction,
			});
		}
	}

	public invalid(invalidReason?: InvalidActionReason): AppearanceActionProcessingResultInvalid {
		this.addProblem({
			result: 'invalidAction',
			reason: invalidReason,
		});
		return new AppearanceActionProcessingResultInvalid(this);
	}

	public finalize(): AppearanceActionProcessingResultValid | AppearanceActionProcessingResultInvalid {
		const validationResult = this.manipulator.currentState.validate();
		if (!validationResult.success) {
			this.addProblem({
				result: 'validationError',
				validationError: validationResult.error,
			});
		}
		if (this._actionProblems.length > 0)
			return new AppearanceActionProcessingResultInvalid(this);

		return new AppearanceActionProcessingResultValid(this, this.manipulator.currentState);
	}
}

abstract class AppearanceActionProcessingResultBase {
	private readonly _finalProcessingContext: AppearanceActionProcessingContext;

	public readonly originalState: AssetFrameworkGlobalState;

	public abstract readonly problems: readonly AppearanceActionProblem[];

	public readonly requiredPermissions: ReadonlySet<GameLogicPermission>;

	constructor(processingContext: AppearanceActionProcessingContext) {
		this._finalProcessingContext = processingContext;
		this.originalState = processingContext.originalState;
		this.requiredPermissions = processingContext.requiredPermissions;
	}

	public addAdditionalProblems(additionalProblems: readonly AppearanceActionProblem[]): AppearanceActionProcessingResult {
		return new AppearanceActionProcessingResultInvalid(this._finalProcessingContext, additionalProblems);
	}
}

export class AppearanceActionProcessingResultInvalid extends AppearanceActionProcessingResultBase {
	public readonly valid = false;
	public readonly prompt: null | CharacterId;

	public readonly problems: readonly AppearanceActionProblem[];

	constructor(processingContext: AppearanceActionProcessingContext, additionalProblems: readonly AppearanceActionProblem[] = []) {
		super(processingContext);
		this.problems = uniqWith([...processingContext.actionProblems, ...additionalProblems], isEqual);
		Assert(this.problems.length > 0);

		let prompt = null;
		for (const problem of this.problems) {
			if (problem.result !== 'restrictionError' || problem.restriction.type !== 'missingPermission' || problem.restriction.permissionResult !== 'prompt') {
				prompt = null;
				break;
			}
			if (prompt == null) {
				prompt = problem.restriction.target;
			} else {
				// TODO: Support multiple prompts when we have actions with multiple targets, for now this should never happen
				Assert(prompt !== problem.restriction.target, 'Multiple prompts for different targets');
			}
		}
		this.prompt = prompt;
	}
}

export class AppearanceActionProcessingResultValid extends AppearanceActionProcessingResultBase {
	public readonly valid = true;

	public readonly problems: readonly AppearanceActionProblem[] = [];
	public readonly resultState: AssetFrameworkGlobalState;
	public readonly pendingMessages: readonly ActionHandlerMessage[];

	constructor(processingContext: AppearanceActionProcessingContext, resultState: AssetFrameworkGlobalState) {
		super(processingContext);
		this.resultState = resultState;
		this.pendingMessages = processingContext.pendingMessages;
		Assert(processingContext.actionProblems.length === 0);
		Assert(this.resultState.isValid());
	}
}

export type AppearanceActionProcessingResult = AppearanceActionProcessingResultValid | AppearanceActionProcessingResultInvalid;
