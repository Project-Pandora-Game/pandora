import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_lock_unlock_others = DefineCharacterModifier({
	typeId: 'block_lock_unlock_others',
	visibleName: 'Block: Forbid unlocking locks on others',
	description: `
This modifier prevents the character from unlocking any lock on other characters or also on items in the room inventory.
	`,
	strictnessCategory: 'normal',
	config: {
		affectRoomInventory: {
			name: 'Also prevent unlocking items in the room inventory',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, _result) {
		if (
			action.type === 'moduleAction' &&
			action.action.moduleType === 'lockSlot' &&
			action.action.lockAction.action === 'unlock'
		) {
			if (action.target.type === 'character' && action.target.characterId !== player.character.id) {
				return 'block';
			} else if (action.target.type === 'room' && config.affectRoomInventory) {
				return 'block';
			}
		}

		return 'allow';
	},
});
