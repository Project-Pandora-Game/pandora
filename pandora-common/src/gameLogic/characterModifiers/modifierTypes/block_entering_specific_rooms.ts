import { LIMIT_ROOM_NAME_LENGTH, LIMIT_ROOM_NAME_PATTERN } from '../../../inputLimits.ts';
import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_entering_specific_rooms = DefineCharacterModifier({
	typeId: 'block_entering_specific_rooms',
	visibleName: 'Block: Prevent entering specific rooms',
	description: `
This modifier makes the character unable to move to rooms with the set names. This is space independent, but you can use activation conditions to apply this only to specific spaces. Matching is done against both the room's name (case insensitive) and its unique identifier.

Note that this modifier will not work well on owners and admins within a space on its own as they can move to all rooms in a space directly (not only to neighboring rooms) and can rename/delete/create rooms at any time. There is another character modifier to prevent managing room maps, which can deal with this "issue".
	`,
	strictnessCategory: 'normal',
	config: {
		forbiddenRoomNames: {
			name: 'List of room names that cannot be entered',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 100,
				maxEntryLength: LIMIT_ROOM_NAME_LENGTH,
				matchEntry: LIMIT_ROOM_NAME_PATTERN,
			},
		},
	},

	checkCharacterAction(config, action, player, result) {
		if (action.type !== 'moveCharacter')
			return 'allow';

		if (action.moveTo.type === 'normal') {
			const targetRoom = player.appearance.gameState.space.getRoom(action.moveTo.room);
			// Only limit if the room actually changes - not movement within the room if brought there through other means
			if (targetRoom != null && targetRoom.id !== result.originalState.getCharacterState(player.appearance.id)?.currentRoom) {
				const targetRoomName = targetRoom.displayName;
				const targetRoomId = targetRoom.id;

				if (config.forbiddenRoomNames.find((n) => n.toLowerCase() === targetRoomName.toLowerCase()) ||
					config.forbiddenRoomNames.includes(targetRoomId)
				) {
					return 'block';
				}
			}
		}

		return 'allow';
	},
});
