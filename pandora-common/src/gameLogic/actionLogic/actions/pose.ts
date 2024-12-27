import { z } from 'zod';
import { AppearanceArmPoseSchema, AppearanceArmsOrderSchema, AppearancePoseSchema, CharacterViewSchema, LegsPoseSchema } from '../../../assets';
import { CharacterIdSchema } from '../../../character';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionPose = z.object({
	type: z.literal('pose'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones.optional(),
	leftArm: AppearanceArmPoseSchema.partial().optional(),
	rightArm: AppearanceArmPoseSchema.partial().optional(),
	armsOrder: AppearanceArmsOrderSchema.partial().optional(),
	legs: LegsPoseSchema.optional(),
	view: CharacterViewSchema.optional(),
});

/** Change character's pose. */
export function ActionPose({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionPose>>): AppearanceActionProcessingResult {
	const target = processingContext.getTargetCharacter({ type: 'character', characterId: action.target });
	if (!target)
		return processingContext.invalid();

	processingContext.checkInteractWithTarget(target);

	if (!processingContext.manipulator.produceCharacterState(action.target, (character) => {
		return character.produceWithPose(action, 'pose');
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
