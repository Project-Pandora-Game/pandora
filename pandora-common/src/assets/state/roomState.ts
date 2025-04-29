import { freeze } from 'immer';
import { z } from 'zod';
import type { Logger } from '../../logging/logger.ts';
import type { SpaceId } from '../../space/index.ts';
import { Assert, MemoizeNoArg } from '../../utility/misc.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { Item } from '../item/base.ts';
import { AppearanceItemsBundleSchema, AppearanceItemsDeltaBundleSchema, ApplyAppearanceItemsDeltaBundle, CalculateAppearanceItemsDeltaBundle, type AppearanceItems } from '../item/items.ts';
import type { IExportOptions } from '../modules/common.ts';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation.ts';

export const RoomInventoryBundleSchema = z.object({
	items: AppearanceItemsBundleSchema,
	clientOnly: z.boolean().optional(),
});

export type RoomInventoryBundle = z.infer<typeof RoomInventoryBundleSchema>;
export type RoomInventoryClientBundle = RoomInventoryBundle & { clientOnly: true; };

export const RoomInventoryClientDeltaBundleSchema = z.object({
	items: AppearanceItemsDeltaBundleSchema.optional(),
});
export type RoomInventoryClientDeltaBundle = z.infer<typeof RoomInventoryClientDeltaBundleSchema>;

export const ROOM_INVENTORY_BUNDLE_DEFAULT: RoomInventoryBundle = {
	items: [],
};

/**
 * State of an space. Immutable.
 */
export class AssetFrameworkRoomState {
	public readonly type = 'roomInventory';
	public readonly assetManager: AssetManager;
	public readonly spaceId: SpaceId | null;

	public readonly items: AppearanceItems;

	private constructor(
		assetManager: AssetManager,
		spaceId: SpaceId | null,
		items: AppearanceItems,
	) {
		this.assetManager = assetManager;
		this.spaceId = spaceId;
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

	public exportToClientDeltaBundle(originalState: AssetFrameworkRoomState, options: IExportOptions = {}): RoomInventoryClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		Assert(this.spaceId === originalState.spaceId);
		options.clientOnly = true;

		const result: RoomInventoryClientDeltaBundle = {};

		if (this.items !== originalState.items) {
			result.items = CalculateAppearanceItemsDeltaBundle(originalState.items, this.items, options);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: RoomInventoryClientDeltaBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		let items = this.items;

		if (bundle.items !== undefined) {
			items = ApplyAppearanceItemsDeltaBundle(this.assetManager, this.items, bundle.items, logger);
		}

		const resultState = freeze(new AssetFrameworkRoomState(
			this.assetManager,
			this.spaceId,
			items,
		), true);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(
			this.assetManager,
			this.spaceId,
			newItems,
		);
	}

	public static createDefault(assetManager: AssetManager, spaceId: SpaceId | null): AssetFrameworkRoomState {
		return AssetFrameworkRoomState.loadFromBundle(assetManager, ROOM_INVENTORY_BUNDLE_DEFAULT, spaceId, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: RoomInventoryBundle, spaceId: SpaceId | null, logger: Logger | undefined): AssetFrameworkRoomState {
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
			spaceId,
			newItems,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
