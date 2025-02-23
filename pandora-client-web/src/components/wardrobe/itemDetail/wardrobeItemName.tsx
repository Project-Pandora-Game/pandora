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

	if (item.name && item.name !== item.asset.definition.name && itemDisplayNameType === 'custom') {
		return (
			<i>
				{ ResolveItemDisplayName(item, itemDisplayNameType) }
			</i>
		);
	}
	return (
		<>
			{ ResolveItemDisplayName(item, itemDisplayNameType) }
		</>
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
			return `${custom} [${original}]`;
		default:
			AssertNever(itemDisplayNameType);
	}
}
