import type { Immutable } from 'immer';
import { ZodTypeDef, z } from 'zod';

import type { ItemId } from '../appearanceTypes';
import type { LockBundle } from './lock';
import type { RoomDeviceBundle, RoomDeviceLink } from './roomDevice';
import type { AssetColorization, AssetType, WearableAssetType } from '../definitions';
import type { AssetManager } from '../assetManager';
import type { AssetFrameworkRoomState } from '../state/roomState';
import type { GameLogicCharacter } from '../../gameLogic';
import type { ItemBase, InternalItemTypeMap } from './_internal';
import type { Satisfies } from '../../utility';

import { AssetIdSchema, AssetId } from '../base';
import { ItemModuleTemplateSchema, ItemModuleData, ItemModuleTemplate } from '../modules';
import { HexRGBAColorStringSchema, HexRGBAColorString, ZodArrayWithInvalidDrop } from '../../validation';
import { LIMIT_OUTFIT_NAME_LENGTH } from '../../inputLimits';
import { Logger } from '../../logging';

export type ItemTypeMap =
	Satisfies<
		InternalItemTypeMap,
		{
			[type in AssetType]: ItemBase<type>;
		}
	>;

export type Item<Type extends AssetType = AssetType> = ItemTypeMap[Type];

export const ItemColorBundleSchema = z.record(z.string(), HexRGBAColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

/**
 * Serializable data bundle containing information about an item.
 * Used for storing appearance or room data in database and for transferring it to the clients.
 */
export type ItemBundle = {
	id: ItemId;
	asset: AssetId;
	color?: ItemColorBundle | HexRGBAColorString[];
	moduleData?: Record<string, ItemModuleData>;
	/** Room device specific data */
	roomDeviceData?: RoomDeviceBundle;
	/** Room device this part is linked to, only present for `roomDeviceWearablePart` */
	roomDeviceLink?: RoomDeviceLink;
	/** Lock specific data */
	lockData?: LockBundle;
};

/**
 * Data describing an item configuration as a template.
 * Used for creating a new item from the template with matching configuration.
 */
export type ItemTemplate = {
	asset: AssetId;
	templateName?: string;
	color?: ItemColorBundle;
	modules?: Record<string, ItemModuleTemplate>;
};

/**
 * Data describing an item configuration as a template.
 * Used for creating a new item from the template with matching configuration.
 * @note The schema is duplicated because of TS limitation on inferring type that contains recursion (through storage/lock modules)
 */
export const ItemTemplateSchema: z.ZodType<ItemTemplate, ZodTypeDef, unknown> = z.object({
	asset: AssetIdSchema,
	templateName: z.string().optional(),
	color: ItemColorBundleSchema.optional(),
	modules: z.record(z.lazy(() => ItemModuleTemplateSchema)).optional(),
});

export const AssetFrameworkOutfitSchema = z.object({
	name: z.string().max(LIMIT_OUTFIT_NAME_LENGTH),
	items: ZodArrayWithInvalidDrop(ItemTemplateSchema, z.record(z.unknown())),
});
export type AssetFrameworkOutfit = z.infer<typeof AssetFrameworkOutfitSchema>;

export const AssetFrameworkOutfitWithIdSchema = AssetFrameworkOutfitSchema.extend({
	/** Random ID used to keep track of the outfits to avoid having to address them by index */
	id: z.string(),
});
export type AssetFrameworkOutfitWithId = z.infer<typeof AssetFrameworkOutfitWithIdSchema>;

export type IItemLoadContext = {
	assetManager: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
};

export type IItemCreationContext = {
	assetManager: AssetManager;
	creator: GameLogicCharacter;
};

export type IItemValidationContext = {
	location: IItemLocationDescriptor;
	roomState: AssetFrameworkRoomState | null;
};

export type ColorGroupResult = {
	item: Item;
	colorization: Immutable<AssetColorization>;
	color: HexRGBAColorString;
};

export function FilterItemType<T extends AssetType>(type: T): (item: Item) => item is Item<T> {
	return (item): item is Item<T> => item.isType(type);
}

export function FilterItemWearable(item: Item): item is Item<WearableAssetType> {
	return item.isWearable();
}

export type IItemLocationDescriptor = 'worn' | 'attached' | 'stored' | 'roomInventory';
