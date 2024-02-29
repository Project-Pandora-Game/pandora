import { freeze } from 'immer';
import { z } from 'zod';
import { Logger } from '../../logging';
import { Assert, MemoizeNoArg } from '../../utility';
import { ZodArrayWithInvalidDrop } from '../../validation';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { Item } from '../item/base';
import { ItemBundleSchema } from '../item/unified';
import type { IExportOptions } from '../modules/common';
import { SpaceInventoryLoadAndValidate, ValidateSpaceInventoryItems } from '../validation/inventoryValidation';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

export const SpaceInventoryBundleSchema = z.object({
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	clientOnly: z.boolean().optional(),
});

export type SpaceInventoryBundle = z.infer<typeof SpaceInventoryBundleSchema>;
export type SpaceInventoryClientBundle = SpaceInventoryBundle & { clientOnly: true; };

export const SPACE_INVENTORY_BUNDLE_DEFAULT: SpaceInventoryBundle = {
	items: [],
};

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkSpaceInventoryState {
	public readonly assetManager: AssetManager;

	public readonly items: AppearanceItems;

	private constructor(
		assetManager: AssetManager,
		items: AppearanceItems,
	) {
		this.assetManager = assetManager;
		this.items = items;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = ValidateSpaceInventoryItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(options: IExportOptions = {}): SpaceInventoryBundle {
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): SpaceInventoryClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			clientOnly: true,
		};
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkSpaceInventoryState {
		return new AssetFrameworkSpaceInventoryState(
			this.assetManager,
			newItems,
		);
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkSpaceInventoryState {
		return AssetFrameworkSpaceInventoryState.loadFromBundle(assetManager, SPACE_INVENTORY_BUNDLE_DEFAULT, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: SpaceInventoryBundle, logger: Logger | undefined): AssetFrameworkSpaceInventoryState {
		const parsed = SpaceInventoryBundleSchema.parse(bundle);

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of parsed.items) {
			// Load asset and skip if unknown
			const asset = assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = assetManager.loadItemFromBundle(asset, itemBundle, logger);
			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = SpaceInventoryLoadAndValidate(assetManager, loadedItems, logger);

		// Create the final state
		const resultState = freeze(new AssetFrameworkSpaceInventoryState(
			assetManager,
			newItems,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
