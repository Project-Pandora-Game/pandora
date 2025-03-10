import type { Immutable } from 'immer';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import type { CharacterId } from '../../character/index.ts';
import type { LockDataBundle } from '../../gameLogic/locks/lockData.ts';
import type { Satisfies } from '../../utility/misc.ts';
import type { Asset } from '../asset.ts';
import type { AssetManager } from '../assetManager.ts';
import type { AssetId } from '../base.ts';
import type { AssetColorization, AssetType, WearableAssetType } from '../definitions.ts';
import type { ItemModuleData, ItemModuleTemplate } from '../modules.ts';
import type { AssetFrameworkRoomState } from '../state/roomState.ts';
import type { InternalItemTypeMap, ItemBase } from './_internal.ts';
import type { RoomDeviceBundle } from './roomDevice.ts';
import type { RoomDeviceLink } from './roomDeviceWearablePart.ts';

import { Logger } from '../../logging.ts';
import { HexRGBAColorString, HexRGBAColorStringSchema, ZodTemplateString } from '../../validation.ts';

export const ItemIdSchema = ZodTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

export function GenerateRandomItemId(): ItemId {
	return `i/${nanoid()}`;
}

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
	spawnedBy?: CharacterId;
	color?: ItemColorBundle | HexRGBAColorString[];
	name?: string;
	description?: string;
	/** Whether free hands are required to interact with this item. */
	requireFreeHandsToUse?: boolean;
	moduleData?: Record<string, ItemModuleData>;
	/** Room device specific data */
	roomDeviceData?: RoomDeviceBundle;
	/** Room device this part is linked to, only present for `roomDeviceWearablePart` */
	roomDeviceLink?: RoomDeviceLink;
	/** Lock specific data */
	lockData?: LockDataBundle;
};

/**
 * Data describing an item configuration as a template.
 * Used for creating a new item from the template with matching configuration.
 */
export type ItemTemplate = {
	asset: AssetId;
	templateName?: string;
	color?: ItemColorBundle;
	name?: string;
	description?: string;
	/** Whether free hands are required to interact with this item. */
	requireFreeHandsToUse?: boolean;
	modules?: Record<string, ItemModuleTemplate>;
};

export type IItemLoadContext = {
	assetManager: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
	loadItemFromBundle<T extends AssetType>(asset: Asset<T>, bundle: ItemBundle, context: IItemLoadContext): Item<T>;
};

export type IItemCreationContext = {
	assetManager: AssetManager;
	creator: {
		readonly id: CharacterId;
		readonly name: string;
	};
	createItemBundleFromTemplate(template: ItemTemplate, context: IItemCreationContext): ItemBundle | undefined;
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
