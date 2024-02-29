import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { IItemLocationDescriptor, ItemId } from '../item';
import { ITEM_LIMIT_CHARACTER_WORN, ITEM_LIMIT_SPACE_INVENTORY } from '../itemLimits';
import type { AssetFrameworkSpaceInventoryState } from '../state/spaceInventoryState';

const VALIDATIONS = {
	character: {
		location: 'worn',
		limit: ITEM_LIMIT_CHARACTER_WORN,
	},
	spaceInventory: {
		location: 'spaceInventory',
		limit: ITEM_LIMIT_SPACE_INVENTORY,
	},
} as const satisfies Partial<Record<string, {
	location: IItemLocationDescriptor;
	limit: number;
}>>;

export function ValidateItemsPrefix(
	_assetManager: AssetManager,
	items: AppearanceItems,
	spaceInventory: AssetFrameworkSpaceInventoryState | null,
	type: keyof typeof VALIDATIONS,
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
		const r = item.validate({ location, spaceInventory });
		if (!r.success)
			return r;
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

export function AppearanceItemsCalculateTotalCount(items: AppearanceItems): number {
	let itemCount = 0;
	for (const item of items) {
		itemCount++;
		for (const module of item.getModules().values()) {
			itemCount += AppearanceItemsCalculateTotalCount(module.getContents());
		}
	}
	return itemCount;
}
