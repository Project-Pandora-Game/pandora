import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_changing_following_state = DefineCharacterModifier({
	typeId: 'block_changing_following_state',
	visibleName: 'Block: Prevent own changes to own following states',
	description: `
This modifier makes the character unable to alter following states on the own character, meaning they cannot prevent being made to follow (or being "leashed") by permitted characters.
Additionally, it also prevents the character from entering a room-level item while following someone, as by entering the device, they could break the following state.

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

	checkCharacterAction(config, _action, player, result) {
		const originalState = player.appearance.characterState;
		const resultState = result.resultState.getCharacterState(player.appearance.id);

		if (resultState == null)
			return 'allow';

		const originalFollowing = originalState.position.type === 'normal' && originalState.position.following != null;
		const resultFollowing = resultState.position.type === 'normal' && resultState.position.following != null;

		if (originalFollowing && !resultFollowing) {
			return 'block';
		}

		if (config.blockStarting && !originalFollowing && resultFollowing) {
			return 'block';
		}

		return 'allow';
	},
});
