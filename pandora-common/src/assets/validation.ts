import type { ItemId } from './appearanceTypes';
import type { AssetManager } from './assetManager';
import type { IItemLocationDescriptor, Item } from './item';
import type { AssetFrameworkRoomState } from './state/roomState';
import { AppearanceItemsCalculateTotalCount, AppearanceItems, AppearanceValidationError, AppearanceValidationResult } from './appearanceValidation';
import { ITEM_LIMIT_CHARACTER_WORN, ITEM_LIMIT_ROOM_INVENTORY } from './itemLimits';

const VALIDATIONS = {
	character: {
		location: 'worn',
		limit: ITEM_LIMIT_CHARACTER_WORN,
	},
	room: {
		location: 'roomInventory',
		limit: ITEM_LIMIT_ROOM_INVENTORY,
	},
} as const satisfies Partial<Record<string, {
	location: IItemLocationDescriptor;
	limit: number;
}>>;

export function ValidateItemsPrefix(
	_assetManager: AssetManager,
	items: AppearanceItems,
	roomState: AssetFrameworkRoomState | null,
	type: keyof typeof VALIDATIONS,
	extraChecks?: (item: Item) => AppearanceValidationError | null,
): AppearanceValidationResult {
	const { location, limit } = VALIDATIONS[type];

	// Validate all items
	const ids = new Set<ItemId>();
	for (const item of items) {
		// ID must be unique
		if (ids.has(item.id)) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}
		ids.add(item.id);

		// Run internal item validation
		const r = item.validate({ location, roomState });
		if (!r.success)
			return r;

		const error = extraChecks?.(item);
		if (error)
			return { success: false, error };
	}

	if (AppearanceItemsCalculateTotalCount(items) > limit) {
		return {
			success: false,
			error: {
				problem: 'tooManyItems',
				asset: null,
				limit,
			},
		};
	}

	return { success: true };
}
