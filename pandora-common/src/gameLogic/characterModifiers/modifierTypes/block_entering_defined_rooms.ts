import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_entering_defined_rooms = DefineCharacterModifier({
	typeId: 'block_entering_defined_rooms',
	visibleName: 'Block: Prevent entering defined rooms',
	description: `
This modifier makes the character unable to move to rooms with the set names. This is space independent, but you can use activation conditions to apply this only to specific spaces.

Note that this modifier will not work well on owners and admins within a space as they can move to all rooms in a space directly, not only to neighboring rooms, and can rename/delete/create rooms at any time.
	`,
	strictnessCategory: 'normal',
	config: {
		forbiddenRoomNames: {
			name: 'List of room names that cannot be entered',
			type: 'stringList',
			default: [],
			options: {
				maxCount: 100,
				maxEntryLength: 48,
				matchEntry: /^[a-zA-Z0-9_+\-:'"& ]*$/,
			},
		},
	},

	checkCharacterAction(config, action, player, _result) {
		if (action.type !== 'moveCharacter')
			return 'allow';

		const targetRoom = player.appearance.gameState.space.getRoom(action.moveTo.room);
		const targetRoomName = targetRoom?.displayName;
		const targetRoomId = targetRoom?.id;

		if (action.moveTo.type === 'normal' && (
			targetRoomName && config.forbiddenRoomNames.find((n) => n.toLocaleLowerCase() === targetRoomName.toLocaleLowerCase()) ||
			targetRoomId && config.forbiddenRoomNames.includes(targetRoomId)
		))
			return 'block';

		return 'allow';
	},
});
