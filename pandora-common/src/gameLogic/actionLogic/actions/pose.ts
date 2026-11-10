import { produce } from 'immer';
import * as z from 'zod';
import { PartialAppearancePoseSchema } from '../../../assets/state/characterStatePose.ts';
import { CenteredDegreesSchema } from '../../../assets/state/roomGeometry.ts';
import { CharacterIdSchema } from '../../../character/characterTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionPose = z.object({
	type: z.literal('pose'),
	target: CharacterIdSchema,
	pose: PartialAppearancePoseSchema.optional(),
	// Some parts of movement can be done through posing, too, to simplify things
	rotation: CenteredDegreesSchema.optional(),
	yOffset: z.number().int().optional(),
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
		if (action.pose != null) {
			character = character.produceWithPose(action.pose, 'pose');
		}
		if (action.rotation != null || action.yOffset != null) {
			character = character.produceWithSpacePosition(produce(character.position, (d) => {
				if (action.rotation != null) {
					d.rotation = action.rotation;
				}
				if (action.yOffset != null) {
					d.position[2] = action.yOffset;
				}
			}));
		}
		return character;
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
