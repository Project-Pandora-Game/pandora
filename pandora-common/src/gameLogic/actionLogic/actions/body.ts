import { z } from 'zod';
import { AppearancePoseSchema } from '../../../assets';
import { CharacterIdSchema } from '../../../character';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionBody = z.object({
	type: z.literal('body'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones,
});

/** Resize character's body. */
export function ActionBody({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionBody>>): AppearanceActionProcessingResult {
	const target = processingContext.getTargetCharacter({ type: 'character', characterId: action.target });
	if (!target)
		return processingContext.invalid();

	processingContext.addInteraction(target.character, 'modifyBody');
	processingContext.checkInteractWithTarget(target);

	if (!processingContext.manipulator.produceCharacterState(action.target, (character) => {
		return character.produceWithPose(action, 'body');
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
