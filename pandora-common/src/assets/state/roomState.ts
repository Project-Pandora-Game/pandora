import { Immutable, freeze } from 'immer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { Logger } from '../../logging';
import { DEFAULT_BACKGROUND, ResolveBackground, RoomBackgroundData, RoomBackgroundDataSchema } from '../../space/room';
import { Assert, CloneDeepMutable, MemoizeNoArg } from '../../utility';
import { HexColorStringSchema, ZodArrayWithInvalidDrop, ZodTemplateString } from '../../validation';
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

export const RoomBackgroundConfigSchema = z.union([z.string(), RoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]);
export type RoomBackgroundConfig = z.infer<typeof RoomBackgroundConfigSchema>;

export const RoomBundleSchema = z.object({
	id: RoomIdSchema,
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	/** The ID of the background or custom data */
	background: RoomBackgroundConfigSchema,
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
		background: CloneDeepMutable(DEFAULT_BACKGROUND),
	};
}

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkRoomState {
	public readonly assetManager: AssetManager;

	public readonly id: RoomId;
	public readonly items: AppearanceItems;
	public readonly background: Immutable<RoomBackgroundConfig>;

	private constructor(
		assetManager: AssetManager,
		id: RoomId,
		items: AppearanceItems,
		background: Immutable<RoomBackgroundConfig>,
	) {
		this.assetManager = assetManager;
		this.id = id;
		this.items = items;
		this.background = background;
	}

	@MemoizeNoArg
	public getResolvedBackground(): Immutable<RoomBackgroundData> {
		return ResolveBackground(this.assetManager, this.background);
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
			background: CloneDeepMutable(this.background),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomClientBundle {
		options.clientOnly = true;
		return {
			id: this.id,
			items: this.items.map((item) => item.exportToBundle(options)),
			background: CloneDeepMutable(this.background),
			clientOnly: true,
		};
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(
			this.assetManager,
			this.id,
			newItems,
			this.background,
		);
	}

	public produceWithBackground(newBackground: Immutable<RoomBackgroundConfig>): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(
			this.assetManager,
			this.id,
			this.items,
			newBackground,
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
			bundle.background,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
