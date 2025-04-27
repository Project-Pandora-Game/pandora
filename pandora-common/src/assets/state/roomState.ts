import { freeze } from 'immer';
import { z } from 'zod';
import type { Logger } from '../../logging/logger.ts';
import { Assert, MemoizeNoArg } from '../../utility/misc.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { Item } from '../item/base.ts';
import { AppearanceItemsBundleSchema, type AppearanceItems } from '../item/items.ts';
import type { IExportOptions } from '../modules/common.ts';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation.ts';

export const RoomInventoryBundleSchema = z.object({
	items: AppearanceItemsBundleSchema,
	clientOnly: z.boolean().optional(),
});

export type RoomInventoryBundle = z.infer<typeof RoomInventoryBundleSchema>;
export type RoomInventoryClientBundle = RoomInventoryBundle & { clientOnly: true; };

export const ROOM_INVENTORY_BUNDLE_DEFAULT: RoomInventoryBundle = {
	items: [],
};

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkRoomState {
	public readonly type = 'roomInventory';
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
			const r = ValidateRoomInventoryItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(): RoomInventoryBundle {
		return {
			items: this.items.map((item) => item.exportToBundle({})),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomInventoryClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			clientOnly: true,
		};
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(
			this.assetManager,
			newItems,
		);
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkRoomState {
		return AssetFrameworkRoomState.loadFromBundle(assetManager, ROOM_INVENTORY_BUNDLE_DEFAULT, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: RoomInventoryBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		const parsed = RoomInventoryBundleSchema.parse(bundle);

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
		const newItems = RoomInventoryLoadAndValidate(assetManager, loadedItems, logger);

		// Create the final state
		const resultState = freeze(new AssetFrameworkRoomState(
			assetManager,
			newItems,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
