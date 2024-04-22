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
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation';

// Fix for pnpm resolution weirdness
import type { CharacterId } from '../../character';
import type { } from '../item/base';

export const RoomInventoryBundleSchema = z.object({
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
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

	public exportToBundle(options: IExportOptions = {}): RoomInventoryBundle {
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
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

	public clearSlotsOccupiedByCharacter(characterId: CharacterId): AssetFrameworkRoomState {
		let changed = false;
		const newItems = this.items.map((item) => {
			if (!item.isType('roomDevice')) {
				return item;
			}
			for (const [slot, slotCharacterId] of item.slotOccupancy) {
				if (slotCharacterId === characterId) {
					item = item.changeSlotOccupancy(slot, null) ?? item;
					changed = true;
				}
			}
			return item;
		});
		return changed ? this.produceWithItems(newItems) : this;
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
