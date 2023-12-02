import { Logger } from '../logging';
import { Assert, ShuffleArray } from '../utility';
import { ItemId } from './appearanceTypes';
import { FilterAssetType } from './asset';
import type { AssetManager } from './assetManager';
import type { AssetId, AssetType, WearableAssetType } from './definitions';
import type { Item } from './item';
import { AssetPropertiesResult, CreateAssetPropertiesResult, MergeAssetProperties } from './properties';
import { AssetFrameworkRoomState } from './state/roomState';

/** Appearance items are immutable, so changes can be created as new object, tested, and only then applied */
export type AppearanceItems<Type extends AssetType = AssetType> = readonly Item<Type>[];

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
		// The combination of items doesn't allow for a valid pose
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
		problem: 'canOnlyBeInOneDevice';
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
	return (!item.isType('personal') || item.asset.definition.bodypart === undefined) ? assetManager.bodyparts.length :
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

/** Validates items prefix, ignoring required items */
export function ValidateAppearanceItemsPrefix(assetManager: AssetManager, items: AppearanceItems<WearableAssetType>, roomState: AssetFrameworkRoomState | null): AppearanceValidationResult {
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
		if (!bodypart.allowMultiple && items.filter((item) => item.isType('personal') && item.asset.definition.bodypart === bodypart.name).length > 1)
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
	let hasDevicePart = false;
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
		const r = item.validate({
			location: 'worn',
			roomState,
		});
		if (!r.success)
			return r;

		// Check that characer is in at most once device
		if (item.isType('roomDeviceWearablePart')) {
			if (hasDevicePart) {
				return {
					success: false,
					error: {
						problem: 'canOnlyBeInOneDevice',
					},
				};
			}
			hasDevicePart = true;
		}
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

		// Item's attributes don't count into its own requirements
		const r = AppearanceValidateRequirements(globalProperties.attributes, properties.attributeRequirements, item.asset.id);
		if (!r.success)
			return r;

		globalProperties = item.getPropertiesParts().reduce(MergeAssetProperties, globalProperties);

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
export function ValidateAppearanceItems(assetManager: AssetManager, items: AppearanceItems<WearableAssetType>, roomState: AssetFrameworkRoomState | null): AppearanceValidationResult {
	// Validate prefixes
	for (let i = 1; i <= items.length; i++) {
		const r = ValidateAppearanceItemsPrefix(assetManager, items.slice(0, i), roomState);
		if (!r.success)
			return r;
	}

	// Validate required assets
	for (const bodypart of assetManager.bodyparts) {
		if (bodypart.required && !items.some((item) => item.isType('personal') && item.asset.definition.bodypart === bodypart.name))
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

export function CharacterAppearanceLoadAndValidate(assetManager: AssetManager, originalInput: AppearanceItems, roomState: AssetFrameworkRoomState | null, logger?: Logger): AppearanceItems<WearableAssetType> {
	// First sort input so bodyparts are ordered correctly work
	const input = AppearanceItemsFixBodypartOrder(assetManager, originalInput);

	// Process the input one by one, skipping bad items and injecting missing required bodyparts
	let resultItems: AppearanceItems<WearableAssetType> = [];
	let currentBodypartIndex: number | null = assetManager.bodyparts.length > 0 ? 0 : null;
	for (; ;) {
		const itemToAdd = input.shift();

		// Check moving to next bodypart
		while (
			currentBodypartIndex !== null &&
			(
				itemToAdd == null ||
				!itemToAdd.isType('personal') ||
				itemToAdd.asset.definition.bodypart !== assetManager.bodyparts[currentBodypartIndex].name
			)
		) {
			const bodypart = assetManager.bodyparts[currentBodypartIndex];

			// Check if we need to add required bodypart
			if (bodypart.required && !resultItems.some((item) => item.isType('personal') && item.asset.definition.bodypart === bodypart.name)) {
				// Find matching bodypart assets
				const possibleAssets = assetManager
					.getAllAssets()
					.filter(FilterAssetType('personal'))
					.filter((asset) => asset.definition.bodypart === bodypart.name && asset.definition.allowRandomizerUsage === true);

				ShuffleArray(possibleAssets);

				for (const asset of possibleAssets) {
					const tryFix = [...resultItems, assetManager.createItem(`i/requiredbodypart/${bodypart.name}` as const, asset, logger)];
					if (ValidateAppearanceItemsPrefix(assetManager, tryFix, roomState).success) {
						resultItems = tryFix;
						break;
					}
				}
			}

			if (bodypart.required && !resultItems.some((item) => item.isType('personal') && item.asset.definition.bodypart === bodypart.name)) {
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
		// Skip non-wearable items
		if (!itemToAdd.isWearable()) {
			logger?.warning(`Skipping non-wearable item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
			continue;
		}

		const tryItem: AppearanceItems<WearableAssetType> = [...resultItems, itemToAdd];
		if (!ValidateAppearanceItemsPrefix(assetManager, tryItem, roomState).success) {
			logger?.warning(`Skipping invalid item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
		} else {
			resultItems = tryItem;
		}
	}

	return resultItems;
}
