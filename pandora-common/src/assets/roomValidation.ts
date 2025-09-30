import { Logger } from '../logging/logger.ts';
import type { AppearanceValidationResult } from './appearanceValidation.ts';
import type { AssetManager } from './assetManager.ts';
import type { AppearanceItems } from './item/items.ts';
import { ValidateItemsPrefix } from './validation.ts';

/**
 * Validates items prefix, ignoring required items
 * **If this check returns that `items` are valid, then any _prefix_ of `items` is also valid.**
 */
export function ValidateRoomInventoryItemsPrefix(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Cannot access room state while validating the room itself
	return ValidateItemsPrefix(assetManager, items, null, 'room');
}

/** Validates the room inventory items, including all prefixes */
export function ValidateRoomInventoryItems(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Validate prefixes
	{
		const r = ValidateRoomInventoryItemsPrefix(assetManager, items);
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
