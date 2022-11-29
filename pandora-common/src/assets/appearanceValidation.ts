import { ArmsPose, BONE_MAX, BONE_MIN } from './appearance';
import { ItemId } from './appearanceTypes';
import type { AssetManager } from './assetManager';
import type { AssetDefinitionPoseLimits, AssetId } from './definitions';
import type { Item } from './item';
import { CreateAssetPropertiesResult, MergeAssetProperties } from './properties';

/** Appearance items are immutable, so changes can be created as new object, tested, and only then applied */
export type AppearanceItems = readonly Item[];

export type AppearanceValidationResult = boolean;

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

export type PoseLimitsResult = {
	forcePose: Map<string, [number, number]>;
	forceArms?: ArmsPose;
} | null;

export function MergePoseLimits(base: PoseLimitsResult, poseLimits: AssetDefinitionPoseLimits | undefined): PoseLimitsResult {
	// If already invalid, then invalid
	if (base === null)
		return null;

	if (!poseLimits)
		return base;

	if (poseLimits.forceArms != null) {
		// Invalid combination of forceArms
		if (base.forceArms != null && base.forceArms !== poseLimits.forceArms)
			return null;
		base.forceArms = poseLimits.forceArms;
	}

	if (poseLimits.forcePose != null) {
		for (const [bone, value] of Object.entries(poseLimits.forcePose)) {
			if (value == null)
				continue;

			const limit = typeof value === 'number' ? [value, value] : value;
			let currentLimit = base.forcePose.get(bone) ?? [BONE_MIN, BONE_MAX];

			currentLimit = [
				Math.max(currentLimit[0], limit[0]),
				Math.min(currentLimit[1], limit[1]),
			];

			// Invalid combination of forced bones
			if (currentLimit[0] > currentLimit[1])
				return null;

			base.forcePose.set(bone, currentLimit);
		}
	}

	return base;
}

/**
 * Calculates what pose is enforced by items
 * @param items - Items being worn
 * @returns The enforcement or `null` if the item combination is invalid
 */
export function AppearanceItemsGetPoseLimits(items: AppearanceItems): PoseLimitsResult {
	return items
		.flatMap((item) => item.getPropertiesParts())
		.reduce(MergeAssetProperties, CreateAssetPropertiesResult())
		.poseLimits;
}

export function AppearanceValidateRequirements(attributes: ReadonlySet<string>, requirements: ReadonlySet<string>): AppearanceValidationResult {
	return Array.from(requirements)
		.every((r) => r.startsWith('!') ? !attributes.has(r.substring(1)) : attributes.has(r));
}

/** Validates items prefix, ignoring required items */
export function ValidateAppearanceItemsPrefix(assetMananger: AssetManager, items: AppearanceItems): AppearanceValidationResult {
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

	// Validate all items
	const ids = new Set<ItemId>();
	for (const item of items) {
		// ID must be unique
		if (ids.has(item.id))
			return false;
		ids.add(item.id);

		// Run internal item validation
		if (!item.validate(true))
			return false;
	}

	// Check the pose is possible
	if (AppearanceItemsGetPoseLimits(items) == null)
		return false;

	// Check requirements are met
	let globalProperties = CreateAssetPropertiesResult();
	for (const item of items) {
		// Item's attributes counts into its on requirements
		globalProperties = item.getPropertiesParts().reduce(MergeAssetProperties, globalProperties);

		if (!AppearanceValidateRequirements(globalProperties.attributes, item.getProperties().requirements))
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
export function ValidateAppearanceItems(assetMananger: AssetManager, items: AppearanceItems): AppearanceValidationResult {
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
