import { Logger } from '../logging';
import { Assert, ShuffleArray } from '../utility';
import { ItemId } from './appearanceTypes';
import type { AssetManager } from './assetManager';
import type { AssetId } from './definitions';
import type { Item } from './item';
import { AssetPropertiesResult, AssetSlotResult, CreateAssetPropertiesResult, MergeAssetProperties } from './properties';

/** Appearance items are immutable, so changes can be created as new object, tested, and only then applied */
export type AppearanceItems = readonly Item[];

export type AppearanceValidationError =
	| {
		problem: 'bodypartError';
		problemDetail: 'incorrectOrder' | 'multipleNotAllowed' | 'missingRequired';
	}
	| {
		problem: 'unsatisfiedRequirement';
		asset: AssetId | null;
		requirement: string;
	}
	| {
		problem: 'poseConflict';
	}
	| {
		problem: 'tooManyItems';
		asset: AssetId | null;
		limit: number;
	}
	| {
		problem: 'contentNotAllowed';
		asset: AssetId;
	}
	| {
		problem: 'slotBlockedOrder';
		asset: AssetId;
		slot: string;
	}
	| {
		problem: 'slotFull';
		asset: AssetId;
		slot: string;
	}
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, non-unique ID, and so on...)
	| {
		problem: 'invalid';
	};

export type AppearanceValidationResult = {
	success: true;
} | {
	success: false;
	error: AppearanceValidationError;
};

export function AppearanceValidationCombineResults(result1: AppearanceValidationResult, result2: AppearanceValidationResult): AppearanceValidationResult {
	return !result1.success ? result1 : result2;
}

function GetItemBodypartSortIndex(assetManager: AssetManager, item: Item): number {
	return item.asset.definition.bodypart === undefined ? assetManager.bodyparts.length :
		assetManager.bodyparts.findIndex((bp) => bp.name === item.asset.definition.bodypart);
}

export function AppearanceItemsFixBodypartOrder(assetManager: AssetManager, items: AppearanceItems): Item[] {
	return items
		.slice()
		.sort((a, b) =>
			GetItemBodypartSortIndex(assetManager, a) - GetItemBodypartSortIndex(assetManager, b),
		);
}

export function AppearanceItemProperties(items: AppearanceItems): AssetPropertiesResult {
	return items
		.flatMap((item) => item.getPropertiesParts())
		.reduce(MergeAssetProperties, CreateAssetPropertiesResult());
}

export function AppearanceValidateSlots(assetManager: AssetManager, item: Item, slots: AssetSlotResult): undefined | AppearanceValidationError {
	for (const [slot, occupied] of slots.occupied) {
		if (occupied === 0)
			continue;

		const capacity = assetManager.assetSlots.get(slot)?.capacity ?? 0;
		if (capacity < occupied) {
			return {
				problem: 'slotFull',
				slot,
				asset: item.asset.id,
			};
		}
	}
	return undefined;
}

export function AppearanceValidateSlotBlocks(previousSlots: AssetSlotResult, currentSlot: AssetSlotResult, asset: AssetId): undefined | AppearanceValidationError {
	for (const slot of currentSlot.occupied.keys()) {
		if (!previousSlots.blocked.has(slot))
			continue;

		return { problem: 'slotBlockedOrder', slot, asset };
	}
	return undefined;
}

export function AppearanceValidateRequirements(attributes: ReadonlySet<string>, requirements: ReadonlySet<string>, asset: AssetId | null): AppearanceValidationResult {
	return Array.from(requirements)
		.map((r): AppearanceValidationResult => {
			if (r.startsWith('!') ? !attributes.has(r.substring(1)) : attributes.has(r)) {
				return { success: true };
			}
			return {
				success: false,
				error: {
					problem: 'unsatisfiedRequirement',
					asset,
					requirement: r,
				},
			};
		})
		.reduce(AppearanceValidationCombineResults, { success: true });
}

export function AppearanceGetBlockedSlot(slots: AssetSlotResult, blocked: ReadonlySet<string>): string | undefined {
	for (const slot of slots.occupied.keys()) {
		if (blocked.has(slot))
			return slot;
	}
	return undefined;
}

/** Validates items prefix, ignoring required items */
export function ValidateAppearanceItemsPrefix(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Bodypart validation

	// Check bodypart order
	const correctOrder = AppearanceItemsFixBodypartOrder(assetManager, items);
	if (!correctOrder.every((item, index) => items[index] === item))
		return {
			success: false,
			error: {
				problem: 'bodypartError',
				problemDetail: 'incorrectOrder',
			},
		};

	// Check duplicate bodyparts
	for (const bodypart of assetManager.bodyparts) {
		if (!bodypart.allowMultiple && items.filter((item) => item.asset.definition.bodypart === bodypart.name).length > 1)
			return {
				success: false,
				error: {
					problem: 'bodypartError',
					problemDetail: 'multipleNotAllowed',
				},
			};
	}

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
		const r = item.validate(true);
		if (!r.success)
			return r;
	}

	// Check requirements are met, and check asset count limits
	const assetCounts = new Map<AssetId, number>();
	let globalProperties = CreateAssetPropertiesResult();
	for (const item of items) {
		// TODO: Let assets specify count
		const limit = 1;
		const currentCount = assetCounts.get(item.asset.id) ?? 0;
		if (currentCount >= limit) {
			return {
				success: false,
				error: {
					problem: 'tooManyItems',
					asset: item.asset.id,
					limit,
				},
			};
		}

		const properties = item.getProperties();
		let error = AppearanceValidateSlotBlocks(globalProperties.slots, properties.slots, item.asset.id);
		if (error)
			return { success: false, error };

		// Item's attributes count into its own requirements
		globalProperties = item.getPropertiesParts().reduce(MergeAssetProperties, globalProperties);

		const r = AppearanceValidateRequirements(globalProperties.attributes, properties.requirements, item.asset.id);
		if (!r.success)
			return r;

		error = AppearanceValidateSlots(assetManager, item, globalProperties.slots);
		if (error)
			return { success: false, error };

		assetCounts.set(item.asset.id, currentCount + 1);
	}

	// Check the pose is possible
	if (!globalProperties.limits.valid)
		return {
			success: false,
			error: {
				problem: 'poseConflict',
			},
		};

	return { success: true };
}

/** Validates the appearance items, including all prefixes and required items */
export function ValidateAppearanceItems(assetManager: AssetManager, items: AppearanceItems): AppearanceValidationResult {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		const r = ValidateAppearanceItemsPrefix(assetManager, items.slice(0, i));
		if (!r.success)
			return r;
	}

	// Validate required assets
	for (const bodypart of assetManager.bodyparts) {
		if (bodypart.required && !items.some((item) => item.asset.definition.bodypart === bodypart.name))
			return {
				success: false,
				error: {
					problem: 'bodypartError',
					problemDetail: 'missingRequired',
				},
			};
	}

	return { success: true };
}

export function AppearanceLoadAndValidate(assetManager: AssetManager, originalInput: AppearanceItems, logger?: Logger): AppearanceItems {
	// First sort input so bodyparts are ordered correctly work
	const input = AppearanceItemsFixBodypartOrder(assetManager, originalInput);

	// Process the input one by one, skipping bad items and injecting missing required bodyparts
	let resultItems: AppearanceItems = [];
	let currentBodypartIndex: number | null = assetManager.bodyparts.length > 0 ? 0 : null;
	for (; ;) {
		const itemToAdd = input.shift();
		// Check moving to next bodypart
		while (
			currentBodypartIndex !== null &&
			(
				itemToAdd == null ||
				itemToAdd.asset.definition.bodypart !== assetManager.bodyparts[currentBodypartIndex].name
			)
		) {
			const bodypart = assetManager.bodyparts[currentBodypartIndex];

			// Check if we need to add required bodypart
			if (bodypart.required && !resultItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
				// Find matching bodypart assets
				const possibleAssets = assetManager
					.getAllAssets()
					.filter((asset) => asset.definition.bodypart === bodypart.name && asset.definition.allowRandomizerUsage === true);

				ShuffleArray(possibleAssets);

				for (const asset of possibleAssets) {
					const tryFix = [...resultItems, assetManager.createItem(`i/requiredbodypart/${bodypart.name}` as const, asset, null, logger)];
					if (ValidateAppearanceItemsPrefix(assetManager, tryFix).success) {
						resultItems = tryFix;
						break;
					}
				}
			}

			if (bodypart.required && !resultItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
				throw new Error(`Failed to satisfy the requirement for '${bodypart.name}'`);
			}

			// Move to next bodypart or end validation if all are done
			currentBodypartIndex++;
			if (currentBodypartIndex >= assetManager.bodyparts.length) {
				currentBodypartIndex = null;
			}
		}

		if (itemToAdd == null)
			break;

		Assert(assetManager === itemToAdd.assetManager);
		const tryItem: AppearanceItems = [...resultItems, itemToAdd];
		if (!ValidateAppearanceItemsPrefix(assetManager, tryItem).success) {
			logger?.warning(`Skipping invalid item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
		} else {
			resultItems = tryItem;
		}
	}

	return resultItems;
}
