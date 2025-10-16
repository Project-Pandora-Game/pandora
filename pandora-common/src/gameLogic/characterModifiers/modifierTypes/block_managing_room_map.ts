import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_managing_room_map = DefineCharacterModifier({
	typeId: 'block_managing_room_map',
	visibleName: `Block: Prevent managing room maps of spaces`,
	description: `
This modifier prevents the character from being able to add, remove, reposition, and rename any rooms on a space's room grid, even when they are an owner or admin of the space. Changes to a room's background, walls, settings, or geometry are blocked as well.
Also prevents modifying default room settings.
	`,
	strictnessCategory: 'strict',
	config: {},

	checkCharacterAction(_config, action, _player, _result) {
		if (action.type === 'spaceRoomLayout' ||
			action.type === 'roomConfigure' ||
			(action.type === 'spaceConfigure' && action.globalRoomSettings != null)
		) {
			return 'block';
		}

		return 'allow';
	},
});
