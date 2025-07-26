import { z } from 'zod';
import { RoomIdSchema, RoomNameSchema } from '../../../assets/appearanceTypes.ts';
import { GenerateInitialRoomPosition, IsValidRoomPosition, RoomGeometryConfigSchema } from '../../../assets/state/roomGeometry.ts';
import { AssertNever } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomConfigure = z.object({
	type: z.literal('roomConfigure'),
	roomId: RoomIdSchema,
	name: RoomNameSchema.optional(),
	/** Room geometry to set */
	roomGeometry: RoomGeometryConfigSchema.optional(),
});

/** Moves an item within inventory, reordering the worn order. */
export function ActionRoomConfigure({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomConfigure>>): AppearanceActionProcessingResult {
	const {
		roomId,
		name,
		roomGeometry,
	} = action;

	if (name != null) {
		processingContext.checkPlayerIsSpaceAdmin();

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.withName(name)))
			return processingContext.invalid();
	}

	if (roomGeometry != null) {
		processingContext.checkPlayerIsSpaceAdmin();

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.produceWithRoomGeometry(roomGeometry)))
			return processingContext.invalid();

		const room = processingContext.manipulator.currentState.space.getRoom(roomId);
		if (!room)
			return processingContext.invalid();
		const newBackground = room.roomBackground;

		// Put characters into correct place if needed
		processingContext.manipulator.produceMapCharacters((c) => {
			if (c.position.type === 'normal') {
				if (c.position.room === room.id && !IsValidRoomPosition(newBackground, c.position.position)) {
					return c.produceWithSpacePosition({
						type: 'normal',
						room: room.id,
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
