import { Logger } from '../../logging';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { ValidateItemsPrefix } from './validation';

/** Validates items prefix, ignoring required items */
export function ValidateRoomItemsPrefix(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Cannot access room state while validating the room itself
	const roomState = null;
	return ValidateItemsPrefix(assetManager, items, roomState, 'room');
}

/** Validates the room inventory items, including all prefixes */
export function ValidateRoomItems(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		const r = ValidateRoomItemsPrefix(assetManager, items.slice(0, i));
		if (!r.success)
			return r;
	}

	return { success: true };
}

export function RoomItemsLoadAndValidate(assetManager: AssetManager, originalInput: AppearanceItems, logger?: Logger): AppearanceItems {
	// Get copy we can modify
	const input = originalInput.slice();

	// Process the input one by one, skipping bad items
	let resultItems: AppearanceItems = [];
	for (const itemToAdd of input) {
		const tryItem: AppearanceItems = [...resultItems, itemToAdd];
		if (!ValidateRoomItemsPrefix(assetManager, tryItem).success) {
			logger?.warning(`Skipping invalid item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
		} else {
			resultItems = tryItem;
		}
	}

	return resultItems;
}
