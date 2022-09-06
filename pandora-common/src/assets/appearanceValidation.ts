import { ArmsPose, BONE_MAX, BONE_MIN } from './appearance';
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

/**
 * Calculates what pose is enforced by items
 * @param items - Items being worn
 * @returns The enforcement or `null` if the item combination is invalid
 */
export function AppearanceItemsGetPoseLimits(items: AppearanceItems): {
	forcePose: Map<string, [number, number]>;
	forceArms?: ArmsPose;
} | null {
	const forcePose = new Map<string, [number, number]>();
	let forceArms: ArmsPose | undefined;
	for (const item of items) {
		const poseLimits = item.asset.definition.poseLimits;
		if (!poseLimits)
			continue;

		if (poseLimits.forceArms != null) {
			// Invalid combination of forceArms
			if (forceArms != null && forceArms !== poseLimits.forceArms)
				return null;
			forceArms = poseLimits.forceArms;
		}

		if (poseLimits.forcePose != null) {
			for (const [bone, value] of Object.entries(poseLimits.forcePose)) {
				if (value == null)
					continue;

				const limit = typeof value === 'number' ? [value, value] : value;
				let currentLimit = forcePose.get(bone) ?? [BONE_MIN, BONE_MAX];

				currentLimit = [
					Math.max(currentLimit[0], limit[0]),
					Math.min(currentLimit[1], limit[1]),
				];

				// Invalid combination of forced bones
				if (currentLimit[0] > currentLimit[1])
					return null;

				forcePose.set(bone, currentLimit);
			}
		}
	}

	return {
		forceArms,
		forcePose,
	};
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

	// Check the pose is possible
	if (AppearanceItemsGetPoseLimits(items) == null)
		return false;

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
