import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_lock_unlock_self = DefineCharacterModifier({
	typeId: 'block_lock_unlock_self',
	visibleName: 'Block: Forbid unlocking locks on self',
	description: `
[TODO] This modifier prevents the character from unlocking any lock on themselves.
	`,
	strictnessCategory: 'normal',
	config: {},

	checkCharacterAction(_config, action, player, _originalState, _resultState) {
		if (
			action.type === 'moduleAction' &&
			action.action.moduleType === 'lockSlot' &&
			action.action.lockAction.action === 'unlock' &&
			action.target.type === 'character' &&
			action.target.characterId === player.character.id
		) {
			return 'block';
		}

		return 'allow';
	},
});
