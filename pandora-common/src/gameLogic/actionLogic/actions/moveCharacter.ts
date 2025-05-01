import { z } from 'zod';
import { CharacterSelectorSchema } from '../../../assets/appearanceTypes.ts';
import { CharacterSpacePositionSchema, IsValidRoomPosition } from '../../../assets/state/roomGeometry.ts';
import { AssertNever } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionMoveCharacter = z.object({
	type: z.literal('moveCharacter'),
	/** Target with the item to move */
	target: CharacterSelectorSchema,
	/** Where to move the character */
	moveTo: CharacterSpacePositionSchema,
});

/** Moves a character within a space or a room in a space. */
export function ActionMoveCharacter({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionMoveCharacter>>): AppearanceActionProcessingResult {
	const player = processingContext.getPlayerRestrictionManager();
	const target = processingContext.getCharacter(action.target.characterId);
	if (!target)
		return processingContext.invalid();

	if (target.character.id === player.character.id) {
		// If moving self, must not be restricted by items
		if (player.getEffects().blockRoomMovement)
			return processingContext.invalid(); // TODO: Make this nicer
	} else {
		// Only admin can move other characters
		if (!player.isCurrentSpaceAdmin()) {
			return processingContext.invalid(); // TODO: Make this nicer
		}
	}

	if (action.moveTo.type === 'normal') {
		const spaceContext = processingContext.getSpaceContext();
		// Development rooms don't have position enforcement to allow fine-tuning positioning arguments
		if (!spaceContext.features.includes('development')) {
			if (!IsValidRoomPosition(processingContext.manipulator.currentState.room.roomBackground, action.moveTo.position)) {
				return processingContext.invalid();
			}
		}
	} else {
		AssertNever(action.moveTo.type);
	}

	if (!processingContext.manipulator.produceCharacterState(target.character.id, (character) => {
		return character.produceWithSpacePosition(action.moveTo);
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
