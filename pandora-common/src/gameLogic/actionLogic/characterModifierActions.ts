import type { CharacterId, CharacterRestrictionsManager } from '../../character';
import type { CharacterModifierId, CharacterModifierLockAction, CharacterModifierType, GameLogicModifierInstance } from '../characterModifiers';
import type { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from './appearanceActionProcessingContext';

// Character modifiers happen outside of the character state and action logic frameworks.
// Nevertheless, it is important to be able to validate certain things while interacting with character modifiers (such as permissions and safemode).
// As such functions in this file act as a bridge that doesn't perform the actions in question, but does check the prerequisites.

/**
 * Check if player is allowed to read modifiers of a specific character.
 */
export function CharacterModifierActionCheckRead(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'interact');
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');

	return ctx.finalize();
}

/**
 * Check if player is allowed to add specific modifier to a specific character.
 */
export function CharacterModifierActionCheckAdd(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
	modifierType: CharacterModifierType,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');

	ctx.addRequiredPermission(
		checkTarget.character.characterModifiers.getModifierTypePermission(modifierType),
	);

	// block_adding_new_modifiers modifier handling
	if (checkTarget.appearance.id === player.appearance.id) {
		for (const modifierEffect of player.getModifierEffects()) {
			if (modifierEffect.type === 'block_adding_new_modifiers') {
				ctx.addRestriction({
					type: 'blockedByCharacterModifier',
					modifierId: modifierEffect.id,
					modifierType: modifierEffect.type,
				});
			}
		}
	}

	return ctx.finalize();
}

function CheckModifyModifier(
	ctx: AppearanceActionProcessingContext,
	target: CharacterRestrictionsManager,
	modifier: GameLogicModifierInstance,
): void {
	const player = ctx.getPlayerRestrictionManager();

	player.checkInteractWithTarget(ctx, target.appearance);
	ctx.addInteraction(target.character, 'viewCharacterModifiers');
	ctx.addInteraction(target.character, 'modifyCharacterModifiers');

	ctx.addRequiredPermission(
		target.character.characterModifiers.getModifierTypePermission(modifier.type),
	);

	// Check for the modifier being locked
	if (modifier.lock != null && !modifier.lockExceptions.includes(player.appearance.id)) {
		const lock = modifier.lock.logic;
		if (lock.isLocked()) {
			ctx.addRestriction({
				type: 'characterModifierLocked',
				modifierId: modifier.id,
				modifierType: modifier.type,
				modifierName: modifier.name || modifier.definition.visibleName,
			});
		}
	}
}

/**
 * Check if player is allowed to modify or delete a specific modifier on a specific character.
 */
export function CharacterModifierActionCheckModify(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
	modifier: GameLogicModifierInstance,
): AppearanceActionProcessingResult {
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	CheckModifyModifier(ctx, checkTarget, modifier);

	return ctx.finalize();
}

/**
 * Check if player is allowed to interact with the modifier's lock.
 */
export function CharacterModifierActionCheckLockModify(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
	modifier: GameLogicModifierInstance,
	action: CharacterModifierLockAction,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'lockCharacterModifiers');

	ctx.addRequiredPermission(
		checkTarget.character.characterModifiers.getModifierTypePermission(modifier.type),
	);

	// Lock actions can return problems in client validation state already
	if (action.action === 'lockAction') {
		const result = modifier.doLockAction({
			player,
			isSelfAction: target === player.appearance.id,
			executionContext: 'clientOnlyVerify',
		}, action.lockAction);

		if (result.result !== 'ok') {
			result.problems.forEach((p) => ctx.addProblem(p));
		}
	}

	return ctx.finalize();
}

/**
 * Check if player is allowed to reorder modifiers on a specific character.
 */
export function CharacterModifierActionCheckReorder(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
	modifiers: readonly GameLogicModifierInstance[],
	modifierId: CharacterModifierId,
	shift: number,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');

	const startIndex = modifiers.findIndex((m) => m.id === modifierId);
	if (startIndex < 0)
		return ctx.invalid();

	const endIndex = startIndex + shift;
	if (endIndex < 0 || endIndex >= modifiers.length || !Number.isInteger(endIndex))
		return ctx.invalid();

	if (shift !== 0) {
		const modifier = modifiers[startIndex];
		const movedByModifiers = endIndex < startIndex ? modifiers.slice(endIndex, startIndex) : modifiers.slice(startIndex + 1, endIndex + 1);

		// To move a modifier user needs to be able to modify it
		CheckModifyModifier(ctx, checkTarget, modifier);

		// And all modifiers between start and end positions
		for (const otherModifier of movedByModifiers) {
			CheckModifyModifier(ctx, checkTarget, otherModifier);
		}
	}

	return ctx.finalize();
}
