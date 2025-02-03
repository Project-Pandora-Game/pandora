import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_block_hands = DefineCharacterModifier({
	typeId: 'effect_block_hands',
	visibleName: 'Effect: Block hands',
	description: `
[TODO] This effect blocks hands.
Yes, it does that - same as item!
	`,
	strictnessCategory: 'normal',
	config: {},

	applyCharacterEffects() {
		return {
			blockHands: true,
		};
	},
});
