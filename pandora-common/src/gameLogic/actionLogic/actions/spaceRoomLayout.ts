import { nanoid } from 'nanoid';
import { z } from 'zod';
import { RoomIdSchema } from '../../../assets/appearanceTypes.ts';
import { IntegerCoordinatesSchema, type Coordinates } from '../../../assets/graphics/common.ts';
import { AssetFrameworkRoomState } from '../../../assets/state/roomState.ts';
import { GenerateSpiralCurve } from '../../../math/spaceFillingCurves.ts';
import { AssertNever } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionSpaceRoomLayout = z.object({
	type: z.literal('spaceRoomLayout'),
	subaction: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('createRoom'),
		}),
		z.object({
			type: z.literal('deleteRoom'),
			id: RoomIdSchema,
		}),
		z.object({
			type: z.literal('reorderRoomList'),
			id: RoomIdSchema,
			/** Relative shift for the room inside the room list */
			shift: z.number().int(),
		}),
		z.object({
			/** Moves a room in the space 2D grid */
			type: z.literal('moveRoom'),
			id: RoomIdSchema,
			position: IntegerCoordinatesSchema,
		}),
	]),
});

/** Manipulates rooms and their layout within the space. */
export function ActionSpaceRoomLayout({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionSpaceRoomLayout>>): AppearanceActionProcessingResult {
	const { subaction } = action;

	processingContext.checkPlayerIsSpaceAdmin();

	if (subaction.type === 'createRoom') {
		if (!processingContext.manipulator.produceSpaceState((s) => {
			const playerRoom = s.getRoom(processingContext.getPlayerRestrictionManager().appearance.characterState.currentRoom);
			if (playerRoom == null)
				return null;

			// Find a position for the room as closest free spot to the user
			let position: Coordinates = { x: 0, y: 0 };
			for (const c of GenerateSpiralCurve(playerRoom.position.x, playerRoom.position.y)) {
				if (!s.rooms.some((r) => r.position.x === c.x && r.position.y === c.y)) {
					position = c;
					break;
				}
			}

			return s.withRooms([
				...s.rooms,
				AssetFrameworkRoomState.loadFromBundle(s.assetManager, {
					id: `room:${nanoid()}`,
					name: '',
					items: [],
					position,
					roomGeometry: {
						type: 'defaultPublicSpace',
					},
				}, s.spaceId, undefined),
			]);
		})) {
			return processingContext.invalid();
		}
	} else if (subaction.type === 'deleteRoom') {
		if (!processingContext.manipulator.produceSpaceState((s) => {
			const index = s.rooms.findIndex((r) => r.id === subaction.id);
			if (index < 0)
				return null;

			return s.withRooms(s.rooms.toSpliced(index, 1));
		})) {
			return processingContext.invalid();
		}
	} else if (subaction.type === 'reorderRoomList') {
		if (!processingContext.manipulator.produceSpaceState((s) => {
			const index = s.rooms.findIndex((r) => r.id === subaction.id);
			const newPos = index + subaction.shift;
			if (index < 0 || newPos < 0 || newPos >= s.rooms.length)
				return null;

			const newRooms = s.rooms.slice();
			const moved = newRooms.splice(index, 1);
			newRooms.splice(newPos, 0, ...moved);

			return s.withRooms(newRooms);
		})) {
			return processingContext.invalid();
		}
	} else if (subaction.type === 'moveRoom') {
		if (!processingContext.manipulator.produceRoomState(subaction.id, (r) => r.withPosition(subaction.position)))
			return processingContext.invalid();
	} else {
		AssertNever(subaction);
	}

	// TODO: Make chat messages

	return processingContext.finalize();
}
