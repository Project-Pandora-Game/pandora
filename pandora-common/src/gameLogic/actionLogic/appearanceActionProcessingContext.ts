import type { Immutable } from 'immer';
import { isEqual, uniqWith } from 'lodash-es';
import { SplitContainerPath } from '../../assets/appearanceHelpers.ts';
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
} from '../../assets/appearanceTypes.ts';
import type { AssetManager } from '../../assets/assetManager.ts';
import type { Item, ItemId } from '../../assets/item/index.ts';
import { AssetFrameworkGlobalStateManipulator } from '../../assets/manipulators/globalStateManipulator.ts';
import { RoomInventory } from '../../assets/roomInventory.ts';
import type { AssetFrameworkGlobalState } from '../../assets/state/globalState.ts';
import type { CharacterId, CharacterRestrictionsManager } from '../../character/index.ts';
import type { ItemInteractionType, Restriction } from '../../character/restrictionTypes.ts';
import { Assert, AssertNever, AssertNotNullable } from '../../utility/misc.ts';
import type { AppearanceAction, GameLogicCharacter, GameLogicPermission, InteractionId } from '../index.ts';
import type { AppearanceActionData, AppearanceActionProblem, InvalidActionReason } from './appearanceActionProblems.ts';
import type { AppearanceActionContext } from './appearanceActions.ts';
import { GAME_LOGIC_ACTION_SLOWDOWN_TIMES, type GameLogicActionSlowdownReason } from './appearanceActionSlowdown.ts';

export class AppearanceActionProcessingContext {
	private readonly _context: AppearanceActionContext;

	public get player(): GameLogicCharacter {
		return this._context.player;
	}

	public get executionContext(): AppearanceActionContext['executionContext'] {
		return this._context.executionContext;
	}

	public readonly assetManager: AssetManager;
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

	private readonly _actionSlowdownReasons = new Set<GameLogicActionSlowdownReason>();
	public get actionSlowdownReasons(): ReadonlySet<GameLogicActionSlowdownReason> {
		return this._actionSlowdownReasons;
	}

	private readonly _requiredPermissions = new Set<GameLogicPermission>();
	public get requiredPermissions(): ReadonlySet<GameLogicPermission> {
		return this._requiredPermissions;
	}

	private readonly _performedActions: Immutable<AppearanceAction>[] = [];
	public get performedActions(): readonly Immutable<AppearanceAction>[] {
		return this._performedActions;
	}

	private readonly _actionData: AppearanceActionData[] = [];
	public get actionData(): readonly AppearanceActionData[] {
		return this._actionData;
	}

	constructor(context: AppearanceActionContext, initialState: AssetFrameworkGlobalState) {
		this._context = context;
		this.assetManager = initialState.assetManager;
		this.originalState = initialState;

		this.manipulator = new AssetFrameworkGlobalStateManipulator(this.originalState);
	}

	public getPlayerRestrictionManager(): CharacterRestrictionsManager {
		const playerRestrictionManager = this.getCharacter(this.player.id);
		AssertNotNullable(playerRestrictionManager);
		return playerRestrictionManager;
	}

	public getCharacter(id: CharacterId): CharacterRestrictionsManager | null {
		const char = this._context.getCharacter(id);

		if (char == null)
			return null;

		return char.getRestrictionManager(this.manipulator.currentState, this._context.spaceContext);
	}

	public getTargetCharacter(target: ActionCharacterSelector): ActionTargetCharacter | null {
		const char = this._context.getCharacter(target.characterId);

		if (char == null)
			return null;

		return char.getAppearance(this.manipulator.currentState);
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

	/** Adds a slowdown to the action */
	public addSlowdown(slowdown: GameLogicActionSlowdownReason): void {
		this._actionSlowdownReasons.add(slowdown);
	}

	public addPerformedAction(action: Immutable<AppearanceAction>): void {
		this._performedActions.push(action);
	}

	public addData(data: AppearanceActionData): void {
		// Avoid adding duplicate data
		if (this._actionData.some((existingData) => isEqual(existingData, data)))
			return;

		this._actionData.push(data);
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
		restrictionManager.checkInteractWithTarget(this, target);
	}

	public checkCanUseItem(target: ActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		restrictionManager.checkUseItem(this, target, itemPath, interaction, insertBeforeRootItem);
	}

	public checkCanUseItemDirect(target: ActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		restrictionManager.checkUseItemDirect(this, target, container, item, interaction, insertBeforeRootItem);
	}

	public checkCanUseItemModule(target: ActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): void {
		const restrictionManager = this.getPlayerRestrictionManager();
		restrictionManager.checkUseItemModule(this, target, itemPath, moduleName, interaction);
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
	protected readonly _finalProcessingContext: AppearanceActionProcessingContext;

	public readonly originalState: AssetFrameworkGlobalState;

	/** Slowdown that should be applied to this action */
	public readonly actionSlowdownReasons: ReadonlySet<GameLogicActionSlowdownReason>;
	public readonly actionExtraSlowdown: number;

	public readonly performedActions: readonly Immutable<AppearanceAction>[];

	public readonly requiredPermissions: ReadonlySet<GameLogicPermission>;

	protected constructor(processingContext: AppearanceActionProcessingContext, actionExtraSlowdown: number) {
		this._finalProcessingContext = processingContext;
		this.originalState = processingContext.originalState;
		if (actionExtraSlowdown > 0) {
			this.actionSlowdownReasons = new Set<GameLogicActionSlowdownReason>([...processingContext.actionSlowdownReasons, 'modifierSlowdown']);
		} else {
			this.actionSlowdownReasons = processingContext.actionSlowdownReasons;
		}
		this.actionExtraSlowdown = actionExtraSlowdown;
		this.performedActions = processingContext.performedActions;
		this.requiredPermissions = processingContext.requiredPermissions;
	}

	public abstract addAdditionalProblems(...additionalProblems: readonly AppearanceActionProblem[]): AppearanceActionProcessingResultInvalid;
	public abstract addAdditionalSlowdown(slowdownMilliseconds: number): AppearanceActionProcessingResult;

	/** Calculates the action slowdown time (in milliseconds) */
	public getActionSlowdownTime(): number {
		let total = 0;
		for (const reason of this.actionSlowdownReasons) {
			total += GAME_LOGIC_ACTION_SLOWDOWN_TIMES[reason];
		}
		total += this.actionExtraSlowdown;
		return total;
	}
}

export class AppearanceActionProcessingResultInvalid extends AppearanceActionProcessingResultBase {
	public readonly valid = false;
	public readonly prompt: null | CharacterId;

	public readonly pendingMessages: readonly ActionHandlerMessage[];

	public readonly problems: readonly AppearanceActionProblem[];

	protected readonly _additionalProblems: readonly AppearanceActionProblem[];

	constructor(processingContext: AppearanceActionProcessingContext, actionExtraSlowdown: number = 0, additionalProblems: readonly AppearanceActionProblem[] = []) {
		super(processingContext, actionExtraSlowdown);
		this._additionalProblems = additionalProblems;
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

	public override addAdditionalProblems(...additionalProblems: readonly AppearanceActionProblem[]): AppearanceActionProcessingResultInvalid {
		return new AppearanceActionProcessingResultInvalid(
			this._finalProcessingContext,
			this.actionExtraSlowdown,
			[...this._additionalProblems, ...additionalProblems],
		);
	}

	public override addAdditionalSlowdown(slowdownMilliseconds: number): AppearanceActionProcessingResultInvalid {
		return new AppearanceActionProcessingResultInvalid(
			this._finalProcessingContext,
			this.actionExtraSlowdown + slowdownMilliseconds,
			this._additionalProblems,
		);
	}
}

export class AppearanceActionProcessingResultValid extends AppearanceActionProcessingResultBase {
	public readonly valid = true;

	public readonly resultState: AssetFrameworkGlobalState;
	public readonly pendingMessages: readonly ActionHandlerMessage[];
	public readonly actionData: readonly AppearanceActionData[];

	constructor(processingContext: AppearanceActionProcessingContext, resultState: AssetFrameworkGlobalState, actionExtraSlowdown: number = 0) {
		super(processingContext, actionExtraSlowdown);
		this.resultState = resultState;
		this.pendingMessages = processingContext.pendingMessages;
		this.actionData = processingContext.actionData;
		Assert(processingContext.actionProblems.length === 0);
		Assert(this.resultState.isValid());
	}

	public override addAdditionalProblems(...additionalProblems: readonly AppearanceActionProblem[]): AppearanceActionProcessingResultInvalid {
		return new AppearanceActionProcessingResultInvalid(
			this._finalProcessingContext,
			this.actionExtraSlowdown,
			additionalProblems,
		);
	}

	public override addAdditionalSlowdown(slowdownMilliseconds: number): AppearanceActionProcessingResultValid {
		return new AppearanceActionProcessingResultValid(
			this._finalProcessingContext,
			this.resultState,
			this.actionExtraSlowdown + slowdownMilliseconds,
		);
	}
}

export type AppearanceActionProcessingResult = AppearanceActionProcessingResultValid | AppearanceActionProcessingResultInvalid;
