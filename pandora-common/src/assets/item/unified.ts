import { nanoid } from 'nanoid';
import { z, ZodTypeDef } from 'zod';

import type { Asset } from '../asset';
import type { AssetType } from '../definitions';

import { ItemIdSchema, ItemId } from '../appearanceTypes';
import { ItemTemplate, IItemCreationContext, ItemBundle, AssetFrameworkOutfit, IItemLoadContext, ItemColorBundleSchema, Item } from './base';
import { AssertNever, Assert } from '../../utility';
import { CreateModuleDataFromTemplate, ItemModuleDataSchema } from '../modules';
import { HexRGBAColorStringSchema } from '../../validation';
import { AssetIdSchema } from '../base';

import { ItemPersonal } from './personal';
import { ItemRoomDevice, RoomDeviceBundleSchema, RoomDeviceLinkSchema } from './roomDevice';
import { ItemRoomDeviceWearablePart } from './roomDeviceWearablePart';
import { ItemLock, LockBundleSchema } from './lock';

/**
 * Serializable data bundle containing information about an item.
 * Used for storing appearance or room data in database and for transferring it to the clients.
 * @note The schema is duplicated because of TS limitation on inferring type that contains recursion (through storage/lock modules)
 */
export const ItemBundleSchema: z.ZodType<ItemBundle, ZodTypeDef, unknown> = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: ItemColorBundleSchema.or(z.array(HexRGBAColorStringSchema)).optional(),
	moduleData: z.record(z.lazy(() => ItemModuleDataSchema)).optional(),
	/** Room device specific data */
	roomDeviceData: RoomDeviceBundleSchema.optional(),
	/** Room device this part is linked to, only present for `roomDeviceWearablePart` */
	roomDeviceLink: RoomDeviceLinkSchema.optional(),
	/** Lock specific data */
	lockData: LockBundleSchema.optional(),
});

export function GenerateRandomItemId(): ItemId {
	return `i/${nanoid()}`;
}

export function CreateItemBundleFromTemplate(template: ItemTemplate, context: IItemCreationContext): ItemBundle | undefined {
	const asset = context.assetManager.getAssetById(template.asset);
	// Fail if the template referrs to asset that is unknown or cannot be spawned by users
	if (asset == null || !asset.canBeSpawned())
		return undefined;

	// Build a bundle from the template
	const bundle: ItemBundle = {
		id: GenerateRandomItemId(),
		asset: asset.id,
		color: template.color,
	};

	// Load modules
	if (template.modules != null && (asset.isType('personal') || asset.isType('roomDevice'))) {
		bundle.moduleData = {};
		for (const [moduleName, moduleTemplate] of Object.entries(template.modules)) {
			const moduleConfig = asset.definition.modules?.[moduleName];
			// Skip unknown modules
			if (moduleConfig == null)
				continue;

			// Actually create the module from template
			const loadedData = CreateModuleDataFromTemplate(moduleConfig, moduleTemplate, context);
			if (loadedData == null)
				continue;

			bundle.moduleData[moduleName] = loadedData;
		}
	}

	return bundle;
}

/** Calculates "cost" for storing the outfit (right now it is count of items, including nested ones; or at least 1 for outfit itself) */
export function OutfitMeasureCost(outfit: AssetFrameworkOutfit): number {
	return Math.max(1, outfit.items.reduce((p, item) => p + ItemTemplateMeasureCost(item), 0));
}

/** Calculates "cost" for storing a specific item (right now it is count of items, including nested ones) */
export function ItemTemplateMeasureCost(template: ItemTemplate): number {
	let result = 1;

	for (const moduleTemplate of Object.values(template.modules ?? {})) {
		if (moduleTemplate.type === 'typed') {
			// No cost for typed modules
		} else if (moduleTemplate.type === 'storage') {
			// Measure nested cost for storage
			result += moduleTemplate.contents.reduce((p, item) => p + ItemTemplateMeasureCost(item), 0);
		} else if (moduleTemplate.type === 'lockSlot') {
			// Measure cost for lock if present
			if (moduleTemplate.lock != null) {
				result += ItemTemplateMeasureCost(moduleTemplate.lock);
			}
		} else {
			AssertNever(moduleTemplate);
		}
	}

	return result;
}

export function LoadItemFromBundle<T extends AssetType>(asset: Asset<T>, bundle: ItemBundle, context: IItemLoadContext): Item<T> {
	Assert(asset.id === bundle.asset);
	const type = asset.type;
	switch (type) {
		case 'personal':
			Assert(asset.isType('personal'));
			// @ts-expect-error: Type specialized manually
			return ItemPersonal.loadFromBundle(asset, bundle, context);
		case 'roomDevice':
			Assert(asset.isType('roomDevice'));
			// @ts-expect-error: Type specialized manually
			return ItemRoomDevice.loadFromBundle(asset, bundle, context);
		case 'roomDeviceWearablePart':
			Assert(asset.isType('roomDeviceWearablePart'));
			// @ts-expect-error: Type specialized manually
			return ItemRoomDeviceWearablePart.loadFromBundle(asset, bundle, context);
		case 'lock':
			Assert(asset.isType('lock'));
			// @ts-expect-error: Type specialized manually
			return ItemLock.loadFromBundle(asset, bundle, context);
	}
	AssertNever(type);
}
