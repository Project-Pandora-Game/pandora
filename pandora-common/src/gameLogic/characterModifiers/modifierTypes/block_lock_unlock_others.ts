import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_lock_unlock_others = DefineCharacterModifier({
	typeId: 'block_lock_unlock_others',
	visibleName: 'Block: Forbid unlocking locks on others',
	description: `
[TODO] This modifier prevents the character from unlocking any lock on other club members or in the room inventory.
	`,
	strictnessCategory: 'normal',
	config: {
		affectRoomInventory: {
			name: 'Also prevent unlocking items in the room inventory',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, _originalState, _resultState) {
		if (
			action.type === 'moduleAction' &&
			action.action.moduleType === 'lockSlot' &&
			action.action.lockAction.action === 'unlock'
		) {
			if (action.target.type === 'character' && action.target.characterId !== player.character.id) {
				return 'block';
			} else if (action.target.type === 'roomInventory' && config.affectRoomInventory) {
				return 'block';
			}
		}

		return 'allow';
	},
});
