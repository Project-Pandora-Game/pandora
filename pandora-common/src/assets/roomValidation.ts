import { Logger } from '../logging';
import { ItemId } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import type { AssetManager } from './assetManager';

export const ROOM_INVENTORY_MAX_ITEMS = 10;

/** Validates items prefix, ignoring required items */
export function ValidateRoomInventoryItemsPrefix(_assetMananger: AssetManager, items: AppearanceItems): AppearanceValidationResult {

	// Validate all items
	const ids = new Set<ItemId>();
	for (const item of items) {
		// ID must be unique
		if (ids.has(item.id))
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		ids.add(item.id);

		// Run internal item validation
		const r = item.validate(false);
		if (!r.success)
			return r;
	}

	// Check there aren't too many items
	if (items.length > ROOM_INVENTORY_MAX_ITEMS)
		return {
			success: false,
			error: {
				problem: 'tooManyItems',
				asset: null,
				limit: ROOM_INVENTORY_MAX_ITEMS,
			},
		};

	return { success: true };
}

/** Validates the room inventory items, including all prefixes */
export function ValidateRoomInventoryItems(assetMananger: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		const r = ValidateRoomInventoryItemsPrefix(assetMananger, items.slice(0, i));
		if (!r.success)
			return r;
	}

	return { success: true };
}

export function RoomInventoryLoadAndValidate(assetManager: AssetManager, originalInput: AppearanceItems, logger?: Logger): AppearanceItems {
	// Get copy we can modify
	const input = originalInput.slice();

	// Process the input one by one, skipping bad items
	let resultItems: AppearanceItems = [];
	for (const itemToAdd of input) {
		const tryItem: AppearanceItems = [...resultItems, itemToAdd];
		if (!ValidateRoomInventoryItemsPrefix(assetManager, tryItem).success) {
			logger?.warning(`Skipping invalid item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
		} else {
			resultItems = tryItem;
		}
	}

	return resultItems;
}

