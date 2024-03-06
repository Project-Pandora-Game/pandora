import { Immutable, freeze } from 'immer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { Logger } from '../../logging';
import { ResolveBackground, RoomBackgroundData, RoomBackgroundDataSchema } from '../../space/room';
import { Assert, CloneDeepMutable, MemoizeNoArg } from '../../utility';
import { HexColorStringSchema, ZodArrayWithInvalidDrop, ZodTemplateString } from '../../validation';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { Item } from '../item/base';
import { ItemBundleSchema } from '../item/unified';
import type { IExportOptions } from '../modules/common';
import { RoomItemsLoadAndValidate, ValidateRoomItems } from '../validation/roomValidation';

export const RoomIdSchema = ZodTemplateString<`room/${string}`>(z.string(), /^room\//);
export type RoomId = z.infer<typeof RoomIdSchema>;

export const RoomBackgroundConfigSchema = z.union([z.string(), RoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]);
export type RoomBackgroundConfig = z.infer<typeof RoomBackgroundConfigSchema>;

export const RoomBundleSchema = z.object({
	id: RoomIdSchema,
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	/** The ID of the background or custom data; null = default */
	background: RoomBackgroundConfigSchema.nullable(),
	clientOnly: z.boolean().optional(),
});

export type RoomBundle = z.infer<typeof RoomBundleSchema>;
export type RoomClientBundle = RoomBundle & { clientOnly: true; };

export function GenerateRandomRoomId(): RoomId {
	return `room/${nanoid()}`;
}

export function GenerateDefaultRoomBundle(id: RoomId): RoomBundle {
	return {
		id,
		items: [],
		background: null,
	};
}

interface AssetFrameworkRoomStateProps {
	readonly assetManager: AssetManager;
	readonly id: RoomId;
	readonly items: AppearanceItems;
	readonly background: Immutable<RoomBackgroundConfig> | null;
}

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkRoomState implements AssetFrameworkRoomStateProps {
	public readonly assetManager: AssetManager;

	public readonly id: RoomId;
	public readonly items: AppearanceItems;
	public readonly background: Immutable<RoomBackgroundConfig> | null;

	private constructor(props: AssetFrameworkRoomStateProps);
	private constructor(old: AssetFrameworkRoomState, override: Partial<AssetFrameworkRoomStateProps>);
	private constructor(props: AssetFrameworkRoomStateProps, override: Partial<AssetFrameworkRoomStateProps> = {}) {
		this.assetManager = override.assetManager ?? props.assetManager;
		this.id = override.id ?? props.id;
		this.items = override.items ?? props.items;
		this.background = override.background !== undefined ? override.background : props.background;
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

	public withItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, {
			items: newItems,
		});
	}

	public withBackground(newBackground: Immutable<RoomBackgroundConfig>): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, {
			background: newBackground,
		});
	}

	public static createDefault(assetManager: AssetManager, id: RoomId): AssetFrameworkRoomState {
		return AssetFrameworkRoomState.loadFromBundle(assetManager, GenerateDefaultRoomBundle(id), undefined);
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
		const resultState = freeze(new AssetFrameworkRoomState({
			assetManager,
			id: parsed.id,
			items: newItems,
			background: bundle.background,
		}), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
