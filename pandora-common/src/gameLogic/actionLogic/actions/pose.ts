import { z } from 'zod';
import { CharacterViewSchema, LegsPoseSchema } from '../../../assets/graphics/conditions.ts';
import { AppearanceArmPoseSchema, AppearanceArmsOrderSchema, AppearancePoseSchema } from '../../../assets/state/characterStatePose.ts';
import { CharacterIdSchema } from '../../../character/characterTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

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
