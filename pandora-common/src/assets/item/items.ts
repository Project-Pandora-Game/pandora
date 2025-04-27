import { z } from 'zod';
import type { Logger } from '../../logging/logger.ts';
import { Assert } from '../../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../../validation.ts';
import type { AssetManager } from '../assetManager.ts';
import type { AssetType } from '../definitions.ts';
import type { IExportOptions } from '../modules/common.ts';
import { ItemId, ItemIdSchema, type Item, type ItemBundle } from './base.ts';
import { ItemBundleSchema } from './unified.ts';

/** Appearance items are immutable, so changes can be created as new object, tested, and only then applied */
export type AppearanceItems<Type extends AssetType = AssetType> = readonly Item<Type>[];

export const AppearanceItemsBundleSchema: z.ZodType<ItemBundle[], z.ZodTypeDef, unknown> = ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown()));
export type AppearanceItemsBundle = ItemBundle[];

export const AppearanceItemsDeltaBundleSchema = z.object({
	items: ItemIdSchema.array(),
	bundles: ItemBundleSchema.array().optional(),
});
export type AppearanceItemsDeltaBundle = z.infer<typeof AppearanceItemsDeltaBundleSchema>;

export function CalculateAppearanceItemsDeltaBundle(base: AppearanceItems, target: AppearanceItems, options: IExportOptions): AppearanceItemsDeltaBundle | undefined {
	if (base === target || base.length === target.length && base.every((it, i) => it === target[i]))
		return undefined;

	const result: AppearanceItemsDeltaBundle = {
		items: [],
	};

	const baseItemsMap = new Map<ItemId, Item>();
	for (const item of base) {
		Assert(!baseItemsMap.has(item.id));
		baseItemsMap.set(item.id, item);
	}

	result.items = target.map((item) => {
		if (baseItemsMap.get(item.id) !== item) {
			result.bundles ??= [];
			Assert(result.bundles.every((i) => i.id !== item.id));
			result.bundles.push(item.exportToBundle(options));
		}

		return item.id;
	});

	return result;
}

export function ApplyAppearanceItemsDeltaBundle(assetManager: AssetManager, base: AppearanceItems, delta: AppearanceItemsDeltaBundle, logger: Logger | undefined): AppearanceItems {
	const items = new Map<ItemId, Item>();
	for (const item of base) {
		Assert(!items.has(item.id));
		Assert(item.assetManager === assetManager);
		items.set(item.id, item);
	}
	if (delta.bundles != null) {
		for (const itemBundle of delta.bundles) {
			const asset = assetManager.getAssetById(itemBundle.asset);
			Assert(asset != null, `DESYNC: Unknown asset ${itemBundle.asset}`);

			const item = assetManager.loadItemFromBundle(asset, itemBundle, logger);
			items.set(item.id, item);
		}
	}

	return delta.items.map((id) => {
		const item = items.get(id);
		Assert(item != null, 'DESYNC: Item in appearance items bundle not found');
		return item;
	});
}
