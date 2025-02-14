import type { CharacterId } from '../../character';
import type { CharacterModifierType } from '../characterModifiers';
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
	_modifierType: CharacterModifierType,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');

	// TODO: Check modifier-specific permission

	return ctx.finalize();
}

/**
 * Check if player is allowed to modify or delete a specific modifier on a specific character.
 */
export function CharacterModifierActionCheckModify(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');

	// TODO: Check modifier-specific permission

	return ctx.finalize();
}

/**
 * Check if player is allowed to reorder modifiers on a specific character.
 */
export function CharacterModifierActionCheckReorder(
	ctx: AppearanceActionProcessingContext,
	target: CharacterId,
): AppearanceActionProcessingResult {
	const player = ctx.getPlayerRestrictionManager();
	const checkTarget = ctx.getCharacter(target);
	if (checkTarget == null)
		return ctx.invalid();

	player.checkInteractWithTarget(ctx, checkTarget.appearance);
	ctx.addInteraction(checkTarget.character, 'viewCharacterModifiers');
	ctx.addInteraction(checkTarget.character, 'modifyCharacterModifiers');

	// TODO: Check modifier-specific permission

	return ctx.finalize();
}
