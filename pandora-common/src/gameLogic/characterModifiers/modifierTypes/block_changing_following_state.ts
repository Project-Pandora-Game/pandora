import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_changing_following_state = DefineCharacterModifier({
	typeId: 'block_changing_following_state',
	visibleName: 'Block: Prevent own changes to own following states',
	description: `
This modifier makes the character unable to alter following states on the own character, meaning they cannot prevent being made to follow (or being "leashed") by permitted characters.

Optionally, the character can additionally be prevented to start following others or make them follow.
	`,
	strictnessCategory: 'normal',
	config: {
		blockStarting: {
			name: 'Also block starting to follow or make others follow',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, result) {
		if (action.type !== 'moveCharacter')
			return 'allow';

		if (action.moveTo.type === 'normal') {
			if (!action.moveTo.following && result.originalState.getCharacterState(player.appearance.id)?.position.following && !result.resultState.getCharacterState(player.appearance.id)?.position.following)
				return 'block';

			if (config.blockStarting && action.moveTo.following)
				return 'block';
		}

		return 'allow';
	},
});
