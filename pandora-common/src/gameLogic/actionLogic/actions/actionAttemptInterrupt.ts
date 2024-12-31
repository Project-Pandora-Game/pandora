import { z } from 'zod';
import { CharacterSelectorSchema } from '../../../assets/appearanceTypes';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionAttemptInterruptSchema = z.object({
	type: z.literal('actionAttemptInterrupt'),
	target: CharacterSelectorSchema,
});

/** Change character's pose. */
export function ActionAttemptInterrupt({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionAttemptInterruptSchema>>): AppearanceActionProcessingResult {
	const player = processingContext.getPlayerRestrictionManager();
	const target = processingContext.getTargetCharacter(action.target);
	if (!target)
		return processingContext.invalid();

	// Must be allowed to interact with the target
	processingContext.checkInteractWithTarget(target);

	// Must be able to use hands (struggle-able)
	if (!player.canUseHands() && !player.forceAllowItemActions()) {
		processingContext.addSlowdown('blockedHands');
	}

	// The target must be currently performing an action
	if (target.characterState.attemptingAction == null)
		return processingContext.invalid();

	// Clear the target action attempt
	if (!processingContext.manipulator.produceCharacterState(
		action.target.characterId,
		(character) => character.produceWithAttemptedAction(null),
	)) {
		return processingContext.invalid();
	}

	processingContext.queueMessage({
		id: 'actionInterrupted',
		target: {
			type: 'character',
			id: action.target.characterId,
		},
	});

	return processingContext.finalize();
}
