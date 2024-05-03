import { isEqual, uniqWith } from 'lodash';
import type { CharacterId, CharacterRestrictionsManager } from '../character';
import type { ItemInteractionType, Restriction, RestrictionResult } from '../character/restrictionTypes';
import type { GameLogicCharacter, GameLogicPermission, InteractionId } from '../gameLogic';
import { Assert, AssertNever, AssertNotNullable } from '../utility';
import type { AppearanceActionProblem, InvalidActionReason } from './appearanceActionProblems';
import type { AppearanceActionContext } from './appearanceActions';
import { SplitContainerPath } from './appearanceHelpers';
import type {
	ActionCharacterSelector,
	ActionHandlerMessage,
	ActionHandlerMessageWithTarget,
	ActionTarget,
	ActionTargetCharacter,
	ActionTargetRoomInventory,
	ActionTargetSelector,
	ItemContainerPath,
	ItemPath,
} from './appearanceTypes';
import type { Item, ItemId } from './item';
import { AssetFrameworkGlobalStateManipulator } from './manipulators/globalStateManipulator';
import { RoomInventory } from './roomInventory';
import type { AssetFrameworkGlobalState } from './state/globalState';

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

	public getTargetCharacter(target: ActionCharacterSelector): ActionTargetCharacter | null {
		const char = this._context.getCharacter(target.characterId);
		const charState = this.manipulator.currentState.getCharacterState(target.characterId);
		Assert((char == null) === (charState == null));

		if (char == null || charState == null)
			return null;

		return char.getAppearance(charState);
	}

	public getTargetRoomInventory(): ActionTargetRoomInventory {
		return new RoomInventory(this.manipulator.currentState.room);
	}

	public getTarget(target: ActionTargetSelector): ActionTarget | null {
		if (target.type === 'character') {
			return this.getTargetCharacter(target);
		}

		if (target.type === 'roomInventory') {
			return this.getTargetRoomInventory();
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

	public checkInteractWithTarget(target: ActionTargetCharacter | null): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestrictionResult(restrictionManager.canInteractWithTarget(this, target));
	}

	public checkCanUseItem(target: ActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestrictionResult(restrictionManager.canUseItem(this, target, itemPath, interaction, insertBeforeRootItem));
	}

	public checkCanUseItemDirect(target: ActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestrictionResult(restrictionManager.canUseItemDirect(this, target, container, item, interaction, insertBeforeRootItem));
	}

	public checkCanUseItemModule(target: ActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		this.addRestrictionResult(restrictionManager.canUseItemModule(this, target, itemPath, moduleName, interaction));
	}

	private addRestrictionResult(result: RestrictionResult): void {
		if (!result.allowed) {
			this.addRestriction(result.restriction);
		}
	}

	public addRestriction(restriction: Restriction): void {
		this.addProblem({
			result: 'restrictionError',
			restriction,
		});
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

	/**
	 * Resolves target container to a character that should be checked for manipulation permissions
	 * @param target - The physical target of the action
	 * @param container - The container path to the container the action is being performed on
	 * @returns The character that should be checked for permission, or `null` if the action doesn't need permissions from a character
	 */
	public resolveTargetCharacter(target: ActionTarget, container: ItemContainerPath): ActionTargetCharacter | null {
		// If we are already targetting a character, the result will be this character
		if (target.type === 'character')
			return target;

		const parent = SplitContainerPath(container);
		if (parent == null)
			return null;

		// If the target container is nested, then check the parent first (parent takes priority)
		const parentTarget = this.resolveTargetCharacter(target, parent.itemPath.container);
		if (parentTarget != null)
			return parentTarget;

		const item = target.getItem(parent.itemPath);
		if (item == null)
			return null;

		// Room device modules can choose different target character
		if (item.isType('roomDevice')) {
			const itemModule = item.getModules().get(parent.module);
			if (itemModule == null)
				return null;

			const slotName = itemModule.config.staticConfig.slotName;
			if (slotName == null) {
				return null;
			}

			const characterId = item.slotOccupancy.get(slotName);
			if (characterId == null) {
				return null;
			}

			// We have a character id to target, resolve it into the character
			return this.getTargetCharacter({
				type: 'character',
				characterId,
			});
		}

		// Nothing to re-target
		return null;
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

	public readonly pendingMessages: readonly ActionHandlerMessage[];

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
				Assert(prompt === problem.restriction.target, 'Multiple prompts for different targets');
			}
		}
		this.prompt = prompt;
		this.pendingMessages = prompt != null ? processingContext.pendingMessages : [];
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
