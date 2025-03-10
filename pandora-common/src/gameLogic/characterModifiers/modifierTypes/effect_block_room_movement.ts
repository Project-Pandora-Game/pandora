import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_room_movement = DefineCharacterModifier({
	typeId: 'effect_block_room_movement',
	visibleName: 'Effect: Block room movement',
	description: `
This effect blocks the character from moving around inside the room.

It does not prevent the character from leaving the space. Admins with a character under this effect can still move other characters.
This is the same effect that some restraining items have.
	`,
	strictnessCategory: 'normal',
	config: {},

	applyCharacterEffects() {
		return {
			blockRoomMovement: true,
		};
	},
});
