import { z } from 'zod';
import { RoomGeometryConfigSchema } from '../../../assets/state/roomGeometry.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomConfigure = z.object({
	type: z.literal('roomConfigure'),
	/** Room geometry to set */
	roomGeometry: RoomGeometryConfigSchema?.optional(),
});

/** Moves an item within inventory, reordering the worn order. */
export function ActionRoomConfigure({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomConfigure>>): AppearanceActionProcessingResult {
	const {
		roomGeometry,
	} = action;

	if (roomGeometry != null) {
		processingContext.checkPlayerIsSpaceAdmin();

		if (!processingContext.manipulator.produceRoomState((r) => r.produceWithRoomGeometry(roomGeometry)))
			return processingContext.invalid();
	}

	// Change message to chat
	// TODO: Message to chat that room background was changed

	return processingContext.finalize();
}
