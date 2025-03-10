import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_space_leaving = DefineCharacterModifier({
	typeId: 'effect_block_space_leaving',
	visibleName: 'Effect: Block leaving the space',
	description: `
This effect blocks the character from leaving the space.
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
