import { nanoid } from 'nanoid';
import * as z from 'zod';
import { RoomIdSchema } from '../../../assets/appearanceTypes.ts';
import { CardinalDirectionSchema, IntegerCoordinatesSchema } from '../../../assets/graphics/common.ts';
import { AssetFrameworkRoomState, RoomTemplateSchema } from '../../../assets/state/roomState.ts';
import { AssertNever, CloneDeepMutable } from '../../../utility/misc.ts';
import { GameLogicRoomSettingsSchema } from '../../spaceSettings/roomSettings.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionSpaceRoomLayout = z.object({
	type: z.literal('spaceRoomLayout'),
	subaction: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('createRoom'),
			template: RoomTemplateSchema,
			position: IntegerCoordinatesSchema,
			direction: CardinalDirectionSchema,
			settings: GameLogicRoomSettingsSchema.partial(),
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
			/** The direction the room should be facing */
			direction: CardinalDirectionSchema,
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

			return s.withRooms([
				...s.rooms,
				AssetFrameworkRoomState.createFromTemplate(
					subaction.template,
					`room:${nanoid()}`,
					CloneDeepMutable(subaction.position),
					subaction.direction,
					subaction.settings,
					processingContext.assetManager,
					s.spaceId,
					processingContext.player,
				),
			]);
		})) {
			return processingContext.invalid();
		}
	} else if (subaction.type === 'deleteRoom') {
		if (
			Array.from(processingContext.manipulator.currentState.characters.values())
				.some((c) => c.currentRoom === subaction.id)
		) {
			return processingContext.invalid('noDeleteOccupiedRoom');
		}

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
		if (!processingContext.manipulator.produceRoomState(subaction.id, (r) => r.withPosition(subaction.position).withDirection(subaction.direction)))
			return processingContext.invalid();
	} else {
		AssertNever(subaction);
	}

	return processingContext.finalize();
}
