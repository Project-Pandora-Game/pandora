import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_prevent_room_leaving = DefineCharacterModifier({
	typeId: 'block_prevent_room_leaving',
	visibleName: 'Block: Prevent leaving the current room',
	description: `This modifier prevents the player from leaving the room they are currently in.
	Please be aware that they still can leave the space they are in.`,
	strictnessCategory: 'normal',
	config: {},

	checkCharacterAction(config, action, player) {
		if (action.type !== 'moveCharacter')
			return 'allow';

		if (action.moveTo.type === 'normal') {
			// Only block if the room actually changes - not movement within the room if brought there through other means
			if (action.moveTo.room !== player.appearance.characterState.currentRoom) {
				return 'block';
			}
		}
		return 'allow';
	},

});
