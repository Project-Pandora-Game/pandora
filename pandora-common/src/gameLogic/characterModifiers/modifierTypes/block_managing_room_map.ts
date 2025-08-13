import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_managing_room_map = DefineCharacterModifier({
	typeId: 'block_managing_room_map',
	visibleName: `Block: Prevent managing room maps of spaces`,
	description: `
This modifier prevents the character from being able to add, remove, reposition, and rename any rooms on a space's room grid, even when they are an owner or admin of the space.
	`,
	strictnessCategory: 'strict',
	config: {},

	// Implemented externally on client only
});
