import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_deleting_items = DefineCharacterModifier({
	typeId: 'block_deleting_items',
	visibleName: 'Block: Forbid deleting items',
	description: `
This modifier prevents the character from deleting any items worn themselves or by other characters, as well as stored inside the room inventory.

Other characters can still delete items on this character while permitted.
	`,
	strictnessCategory: 'normal',
	config: {},

	checkCharacterAction(_config, action, _player, _result) {
		if (action.type === 'delete' || action.type === 'randomize')
			return 'block';

		return 'allow';
	},
});
