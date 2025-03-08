import { isEqual } from 'lodash';
import { DefineCharacterModifier } from '../helpers/modifierDefinition';
import { SplitContainerPath } from '../../../assets/appearanceHelpers';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_equipping_items_others = DefineCharacterModifier({
	typeId: 'block_equipping_items_others',
	visibleName: 'Block: Forbid equipping items on others',
	description: `
This modifier the character from equipping items on other characters, be it new items, items from a storage item, or from room inventory.
	`,
	strictnessCategory: 'normal',
	config: {
		limitStoring: {
			name: 'Forbid storing items in worn storages',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, result) {
		if (action.type !== 'create' && action.type !== 'transfer')
			return 'allow';

		if (action.target.type !== 'character' || action.target.characterId === player.appearance.id)
			return 'allow';

		// Allow reordering things within the same container
		if (action.type === 'transfer' && isEqual(action.target, action.source) && isEqual(action.item.container, action.container))
			return 'allow';

		// If we don't limit storing, allow non-physical targets
		if (!config.limitStoring) {
			let isPhysicallyEquipped = action.target.type === 'character';

			// Check the module if targetting a module
			const upperPath = SplitContainerPath(action.container);
			if (upperPath) {
				const containingModule = result.resultState
					.getItem(action.target, upperPath.itemPath)
					?.getModules().get(upperPath.module);

				if (!containingModule) {
					return 'allow'; // Be nice when we have no clue what happened
				}

				isPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;
			}

			if (!isPhysicallyEquipped)
				return 'allow';
		}

		return 'block';
	},
});
