import { isEqual } from 'lodash-es';
import { SplitContainerPath } from '../../../assets/appearanceHelpers.ts';
import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_removing_items_others = DefineCharacterModifier({
	typeId: 'block_removing_items_others',
	visibleName: 'Block: Forbid removing items on others',
	description: `
This modifier prevents the character from removing items on other characters.
	`,
	strictnessCategory: 'normal',
	config: {
		includeStorage: {
			name: 'Also forbid to remove items from worn storage items',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, result) {
		if (action.type !== 'delete' && action.type !== 'transfer')
			return 'allow';

		const sourceSelector = action.type === 'delete' ? action.target : action.source;
		if (sourceSelector.type !== 'character' || sourceSelector.characterId === player.appearance.id)
			return 'allow';

		// Allow reordering things within the same container
		if (action.type === 'transfer' && isEqual(action.target, action.source) && isEqual(action.item.container, action.container))
			return 'allow';

		// If we don't include storages, allow non-physical targets
		if (!config.includeStorage) {
			let isPhysicallyEquipped = sourceSelector.type === 'character';

			// Check the module if targetting a module
			const upperPath = SplitContainerPath(action.item.container);
			if (upperPath) {
				const containingModule = result.originalState
					.getItem(sourceSelector, upperPath.itemPath)
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
