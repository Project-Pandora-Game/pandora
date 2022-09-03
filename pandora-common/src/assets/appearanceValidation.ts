import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { Item } from './item';

/** Appearance items are immutable, so changes can be created as new object, tested, and only then applied */
export type AppearanceItems = readonly Item[];

function GetItemBodypartSortIndex(assetMananger: AssetManager, item: Item): number {
	return item.asset.definition.bodypart === undefined ? assetMananger.bodyparts.length :
		assetMananger.bodyparts.findIndex((bp) => bp.name === item.asset.definition.bodypart);
}

export function AppearanceItemsFixBodypartOrder(assetMananger: AssetManager, items: AppearanceItems): Item[] {
	return items
		.slice()
		.sort((a, b) =>
			GetItemBodypartSortIndex(assetMananger, a) - GetItemBodypartSortIndex(assetMananger, b),
		);
}

/** Validates items prefix, ignoring required items */
export function ValidateAppearanceItemsPrefix(assetMananger: AssetManager, items: AppearanceItems): boolean {
	// Bodypart validation

	// Check bodypart order
	const correctOrder = AppearanceItemsFixBodypartOrder(assetMananger, items);
	if (!correctOrder.every((item, index) => items[index] === item))
		return false;

	// Check duplicate bodyparts
	for (const bodypart of assetMananger.bodyparts) {
		if (!bodypart.allowMultiple && items.filter((item) => item.asset.definition.bodypart === bodypart.name).length > 1)
			return false;
	}

	const assetCounts = new Map<AssetId, number>();
	// Each asset limits count of it being added
	for (const item of items) {
		// TODO: Let assets specify count
		const limit = 1;
		const currentCount = assetCounts.get(item.asset.id) ?? 0;
		if (currentCount >= limit)
			return false;
		assetCounts.set(item.asset.id, currentCount + 1);
	}

	return true;
}

/** Validates the appearance items, including all prefixes and required items */
export function ValidateAppearanceItems(assetMananger: AssetManager, items: AppearanceItems): boolean {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		if (!ValidateAppearanceItemsPrefix(assetMananger, items.slice(0, i)))
			return false;
	}

	// Validate required assets
	for (const bodypart of assetMananger.bodyparts) {
		if (bodypart.required && !items.some((item) => item.asset.definition.bodypart === bodypart.name))
			return false;
	}

	return true;
}
