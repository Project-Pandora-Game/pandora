import { Logger } from '../logging.ts';
import type { AppearanceItems, AppearanceValidationResult } from './appearanceValidation.ts';
import type { AssetManager } from './assetManager.ts';
import { ValidateItemsPrefix } from './validation.ts';

/** Validates items prefix, ignoring required items */
export function ValidateRoomInventoryItemsPrefix(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Cannot access room state while validating the room itself
	const roomState = null;
	return ValidateItemsPrefix(assetManager, items, roomState, 'room');
}

/** Validates the room inventory items, including all prefixes */
export function ValidateRoomInventoryItems(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		const r = ValidateRoomInventoryItemsPrefix(assetManager, items.slice(0, i));
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
