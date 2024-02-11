import { freeze } from 'immer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { Logger } from '../../logging';
import { Assert, MemoizeNoArg } from '../../utility';
import { ZodArrayWithInvalidDrop, ZodTemplateString } from '../../validation';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { Item } from '../item/base';
import { ItemBundleSchema } from '../item/unified';
import type { IExportOptions } from '../modules/common';
import { RoomItemsLoadAndValidate, ValidateRoomItems } from '../validation/roomValidation';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

export const RoomIdSchema = ZodTemplateString<`room/${string}`>(z.string(), /^room\//);
export type RoomId = z.infer<typeof RoomIdSchema>;

export const RoomBundleSchema = z.object({
	id: RoomIdSchema,
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	clientOnly: z.boolean().optional(),
});

export type RoomBundle = z.infer<typeof RoomBundleSchema>;
export type RoomClientBundle = RoomBundle & { clientOnly: true; };

export function GenerateRandomRoomId(): RoomId {
	return `room/${nanoid()}`;
}

export function GenerateDefaultRoomBundle(): RoomBundle {
	return {
		id: GenerateRandomRoomId(),
		items: [],
	};
}

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkRoomState {
	public readonly assetManager: AssetManager;

	public readonly id: RoomId;
	public readonly items: AppearanceItems;

	private constructor(
		assetManager: AssetManager,
		id: RoomId,
		items: AppearanceItems,
	) {
		this.assetManager = assetManager;
		this.id = id;
		this.items = items;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = ValidateRoomItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(options: IExportOptions = {}): RoomBundle {
		return {
			id: this.id,
			items: this.items.map((item) => item.exportToBundle(options)),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomClientBundle {
		options.clientOnly = true;
		return {
			id: this.id,
			items: this.items.map((item) => item.exportToBundle(options)),
			clientOnly: true,
		};
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(
			this.assetManager,
			this.id,
			newItems,
		);
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkRoomState {
		return AssetFrameworkRoomState.loadFromBundle(assetManager, GenerateDefaultRoomBundle(), undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: RoomBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		const parsed = RoomBundleSchema.parse(bundle);

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
		const newItems = RoomItemsLoadAndValidate(assetManager, loadedItems, logger);

		// Create the final state
		const resultState = freeze(new AssetFrameworkRoomState(
			assetManager,
			parsed.id,
			newItems,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
