import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_room_leaving = DefineCharacterModifier({
	typeId: 'effect_block_room_leaving',
	visibleName: 'Effect: Block leaving the current room',
	description: `This modifier prevents the player from leaving the room they are currently in.
	Please be aware that they still can leave the space they are in.`,
	strictnessCategory: 'normal',
	config: {},

	checkCharacterAction(config, action, player, result) {
		if (action.type !== 'moveCharacter')
			return 'allow';

		if (action.moveTo.type === 'normal') {
			const targetRoom = player.appearance.gameState.space.getRoom(action.moveTo.room);
			// Only block if the room actually changes - not movement within the room if brought there through other means
			if (targetRoom != null && targetRoom.id !== result.originalState.getCharacterState(player.appearance.id)?.currentRoom) {
				return 'block';
			}
		}
		return 'allow';
	},

});
