import React from 'react';
import {
	AssertNever,
	type Item,
	type ItemDisplayNameType,
} from 'pandora-common';
import { useWardrobeContext } from '../wardrobeContext';

export function WardrobeItemName({
	item,
}: {
	item: Item;
}): React.ReactElement {
	const { itemDisplayNameType } = useWardrobeContext();

	return (
		<>
			{ ResolveItemDisplayName(item, itemDisplayNameType) }
		</>
	);
}

export function ResolveItemDisplayName(item: Item, itemDisplayNameType: ItemDisplayNameType): string {
	if (item.name == null || item.name === item.asset.definition.name)
		return item.asset.definition.name;

	switch (itemDisplayNameType) {
		case 'original':
			return item.asset.definition.name;
		case 'custom':
			return item.name;
		case 'custom_with_original_in_brackets':
			return `${item.name} [${item.asset.definition.name}]`;
		default:
			AssertNever(itemDisplayNameType);
	}
}
