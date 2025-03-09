import { DefineCharacterModifier } from '../helpers/modifierDefinition';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_creating_items = DefineCharacterModifier({
	typeId: 'block_creating_items',
	visibleName: 'Block: Forbid creating new items',
	description: `
This modifier prevents the character from creating and adding any new items onto themselves or other characters, as well as into the room inventory.

This modifier also blocks creating new items from saved item collections. Other characters can still create and add items on this character while permitted.
	`,
	strictnessCategory: 'normal',
	config: {},

	checkCharacterAction(_config, action, _player, _result) {
		if (action.type === 'create' || action.type === 'randomize')
			return 'block';

		return 'allow';
	},
});
