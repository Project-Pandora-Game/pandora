import { z } from 'zod';
import { GenerateInitialRoomPosition, IsValidRoomPosition, RoomGeometryConfigSchema } from '../../../assets/state/roomGeometry.ts';
import { AssertNever } from '../../../utility/misc.ts';
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

		const newBackground = processingContext.manipulator.currentState.room.roomBackground;

		// Put characters into correct place if needed
		processingContext.manipulator.produceMapCharacters((c) => {
			if (c.position.type === 'normal') {
				if (!IsValidRoomPosition(newBackground, c.position.position)) {
					return c.produceWithSpacePosition({
						type: 'normal',
						position: GenerateInitialRoomPosition(newBackground),
					});
				}
			} else {
				AssertNever(c.position.type);
			}

			return c;
		});

		processingContext.queueMessage({
			id: 'roomConfigureBackground',
		});
	}

	return processingContext.finalize();
}
