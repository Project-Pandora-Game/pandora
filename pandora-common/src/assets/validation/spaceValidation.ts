import { Logger } from '../../logging';
import { Assert } from '../../utility';
import type { AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { ITEM_LIMIT_SPACE_ROOMS } from '../itemLimits';
import { AssetFrameworkRoomState, RoomId } from '../state/roomState';

/** Validates the room inventory items, including all prefixes */
export function ValidateSpaceRooms(rooms: readonly AssetFrameworkRoomState[]): AppearanceValidationResult {
	// Validate all rooms
	const ids = new Set<RoomId>();
	for (const room of rooms) {
		// ID must be unique
		if (ids.has(room.id)) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}
		ids.add(room.id);

		// Run internal room validation
		const r = room.validate();
		if (!r.success)
			return r;
	}

	if (rooms.length > ITEM_LIMIT_SPACE_ROOMS) {
		return {
			success: false,
			error: {
				problem: 'tooManyRooms',
				limit: ITEM_LIMIT_SPACE_ROOMS,
			},
		};
	}

	return { success: true };
}

export function SpaceRoomsLoadAndValidate(assetManager: AssetManager, originalInput: readonly AssetFrameworkRoomState[], logger?: Logger): readonly AssetFrameworkRoomState[] {
	// Process the rooms one by one, skipping bad rooms
	let resultRooms: readonly AssetFrameworkRoomState[] = [];
	for (const roomToAdd of originalInput) {
		Assert(roomToAdd.assetManager === assetManager);
		const tryRooms: readonly AssetFrameworkRoomState[] = [...resultRooms, roomToAdd];
		if (!ValidateSpaceRooms(tryRooms).success) {
			logger?.warning(`Skipping invalid room ${roomToAdd.id}`);
		} else {
			resultRooms = tryRooms;
		}
	}

	if (resultRooms.length === 0) {
		logger?.warning(`No valid room, adding default`);
		resultRooms = [
			AssetFrameworkRoomState.createDefault(assetManager),
		];
	}

	Assert(ValidateSpaceRooms(resultRooms).success);

	return resultRooms;
}
