import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_hands = DefineCharacterModifier({
	typeId: 'effect_block_hands',
	visibleName: 'Effect: Block hands',
	description: `
This effect blocks hands.
It is the same effect that restraining items such as mittens have.
	`,
	strictnessCategory: 'normal',
	config: {},

	applyCharacterEffects() {
		return {
			blockHands: true,
		};
	},
});
