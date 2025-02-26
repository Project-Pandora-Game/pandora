import classNames from 'classnames';
import {
	AssertNever,
	type Item,
	type ItemDisplayNameType,
} from 'pandora-common';
import type { ReactElement } from 'react';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';

export function WardrobeItemName({
	item,
}: {
	item: Item;
}): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();

	const isCustomName = wardrobeItemDisplayNameType === 'custom' && !!item.name && item.name !== item.asset.definition.name;
	return (
		<span className={ classNames('itemName', isCustomName ? 'custom' : null) }>
			{ ResolveItemDisplayName(item, wardrobeItemDisplayNameType) }
		</span>
	);
}

export function ResolveItemDisplayName(item: Item, itemDisplayNameType: ItemDisplayNameType): string {
	return ResolveItemDisplayNameType(item.asset.definition.name, item.name, itemDisplayNameType);
}

export function ResolveItemDisplayNameType(original: string, custom: string | null | undefined, itemDisplayNameType: ItemDisplayNameType): string {
	if (custom == null || custom === '' || custom === original)
		return original;

	switch (itemDisplayNameType) {
		case 'original':
			return original;
		case 'custom':
			return custom;
		case 'custom_with_original_in_brackets':
			return `${custom} (${original})`;
		default:
			AssertNever(itemDisplayNameType);
	}
}
