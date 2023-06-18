import { nanoid } from 'nanoid';
import {
	AppearanceItems,
	AssertNever,
	EMPTY_ARRAY,
	Item,
	ItemId,
	ItemPath,
} from 'pandora-common';
import { useMemo } from 'react';
import { WardrobeFocus, WardrobeTarget } from './wardrobeTypes';
import { useWardrobeContext } from './wardrobeContext';

export function GenerateRandomItemId(): ItemId {
	return `i/${nanoid()}` as const;
}

export function WardrobeFocusesItem(focus: WardrobeFocus): focus is ItemPath {
	return focus.itemId != null;
}

export function useWardrobeTargetItems(target: WardrobeTarget | null): AppearanceItems {
	const { globalState } = useWardrobeContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null) {
			return null;
		} else if (target.type === 'character') {
			return globalState.getItems({
				type: 'character',
				characterId: target.id,
			});
		} else if (target.type === 'room') {
			return globalState.getItems({
				type: 'roomInventory',
			});
		}
		AssertNever(target);
	}, [globalState, target]);

	return items ?? EMPTY_ARRAY;
}

export function useWardrobeTargetItem(target: WardrobeTarget | null, itemPath: ItemPath | null | undefined): Item | undefined {
	const items = useWardrobeTargetItems(target);

	return useMemo(() => {
		if (!itemPath)
			return undefined;

		const { container, itemId } = itemPath;

		let current: AppearanceItems = items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}, [items, itemPath]);
}
