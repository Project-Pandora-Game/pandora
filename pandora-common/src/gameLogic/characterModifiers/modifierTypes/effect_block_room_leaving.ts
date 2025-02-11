import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_room_leaving = DefineCharacterModifier({
	typeId: 'effect_block_room_leaving',
	visibleName: 'Effect: Block leaving the room',
	description: `
This effect blocks the character from leaving the room.
This is the same effect that some restraining items have.
	`,
	strictnessCategory: 'strict',
	config: {},

	applyCharacterEffects() {
		return {
			blockRoomLeave: true,
		};
	},
});
