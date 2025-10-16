import * as z from 'zod';
import { GameLogicRoomSettingsSchema } from '../../spaceSettings/roomSettings.ts';
import { GameLogicSpaceSettingsSchema } from '../../spaceSettings/spaceSettings.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionSpaceConfigure = z.object({
	type: z.literal('spaceConfigure'),
	spaceSettings: GameLogicSpaceSettingsSchema.partial().optional(),
	globalRoomSettings: GameLogicRoomSettingsSchema.partial().optional(),
});

/** Change global space configuration. */
export function ActionSpaceConfigure({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionSpaceConfigure>>): AppearanceActionProcessingResult {
	const {
		spaceSettings,
		globalRoomSettings,
	} = action;

	if (spaceSettings != null) {
		processingContext.checkPlayerIsSpaceAdmin();

		if (!processingContext.manipulator.produceSpaceState((s) => s.withSpaceSettings(spaceSettings)))
			return processingContext.invalid();
	}

	if (globalRoomSettings != null) {
		processingContext.checkPlayerIsSpaceAdmin();

		if (!processingContext.manipulator.produceSpaceState((s) => s.withGlobalRoomSettings(globalRoomSettings)))
			return processingContext.invalid();
	}

	return processingContext.finalize();
}
