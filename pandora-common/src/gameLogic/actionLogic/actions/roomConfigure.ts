import * as z from 'zod';
import { RoomDescriptionSchema, RoomIdSchema, RoomNameSchema } from '../../../assets/appearanceTypes.ts';
import { GenerateInitialRoomPosition, IsValidRoomPosition, RoomGeometryConfigSchema } from '../../../assets/state/roomGeometry.ts';
import { RoomNeighborLinkNodesConfigSchema } from '../../../assets/state/roomLinkNodeDefinitions.ts';
import { AssertNever } from '../../../utility/misc.ts';
import { GameLogicRoomSettingsSchema } from '../../spaceSettings/roomSettings.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomConfigure = z.object({
	type: z.literal('roomConfigure'),
	roomId: RoomIdSchema,
	name: RoomNameSchema.optional(),
	description: RoomDescriptionSchema.optional(),
	/** Room geometry to set */
	roomGeometry: RoomGeometryConfigSchema.optional(),
	roomLinkNodes: RoomNeighborLinkNodesConfigSchema.partial().optional(),
	settings: GameLogicRoomSettingsSchema.partial().optional(),
});

/** Configures a specific room in a space. */
export function ActionRoomConfigure({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomConfigure>>): AppearanceActionProcessingResult {
	const {
		roomId,
		name,
		description,
		roomGeometry,
		roomLinkNodes,
		settings,
	} = action;

	if (name != null) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveSpaceSettings().roomChangeMinimumRole);

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.withName(name)))
			return processingContext.invalid();
	}

	if (description != null) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveSpaceSettings().roomChangeMinimumRole);

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.withDescription(description)))
			return processingContext.invalid();
	}

	if (roomGeometry != null) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveSpaceSettings().roomChangeMinimumRole);

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.produceWithRoomGeometry(roomGeometry)))
			return processingContext.invalid();

		const room = processingContext.manipulator.currentState.space.getRoom(roomId);
		if (!room)
			return processingContext.invalid();

		// Put characters into correct place if needed
		processingContext.manipulator.produceMapCharacters((c) => {
			if (c.position.type === 'normal') {
				if (c.position.room === room.id && !IsValidRoomPosition(room.roomBackground, c.position.position)) {
					return c.produceWithSpacePosition({
						type: 'normal',
						room: room.id,
						position: GenerateInitialRoomPosition(room),
					});
				}
			} else {
				AssertNever(c.position.type);
			}

			return c;
		});
	}

	if (roomLinkNodes != null) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveSpaceSettings().roomChangeMinimumRole);

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.withRoomLinkNodes({
			far: roomLinkNodes.far ?? r.roomLinkNodes.far,
			right: roomLinkNodes.right ?? r.roomLinkNodes.right,
			near: roomLinkNodes.near ?? r.roomLinkNodes.near,
			left: roomLinkNodes.left ?? r.roomLinkNodes.left,
		})))
			return processingContext.invalid();
	}

	if (settings != null) {
		processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveSpaceSettings().roomChangeMinimumRole);

		if (!processingContext.manipulator.produceRoomState(roomId, (r) => r.withSettings(settings)))
			return processingContext.invalid();
	}

	return processingContext.finalize();
}
