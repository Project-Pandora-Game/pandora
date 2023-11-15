import { Immutable } from 'immer';
import { first } from 'lodash';
import { z } from 'zod';
import { Logger } from '../logging';
import { Assert, AssertNever, MemoizeNoArg, Satisfies, Writeable } from '../utility';
import { HexRGBAColorString, HexRGBAColorStringSchema } from '../validation';
import type { AppearanceModuleActionContext } from './appearanceActions';
import { ItemId, ItemIdSchema } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetColorization, AssetIdSchema, AssetType, WearableAssetType } from './definitions';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IExportOptions, IItemModule } from './modules/common';
import { AssetLockProperties, AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from './properties';
import { CharacterIdSchema, CharacterId } from '../character/characterTypes';
import { CreateRoomDevicePropertiesResult, GetPropertiesForSlot, MergeRoomDeviceProperties, RoomDeviceProperties, RoomDevicePropertiesResult } from './roomDeviceProperties';
import { AssetFrameworkRoomState } from './state/roomState';

export const ItemColorBundleSchema = z.record(z.string(), HexRGBAColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

export const RoomDeviceDeploymentSchema = z.object({
	x: z.number(),
	y: z.number(),
	yOffset: z.number().int().catch(0),
}).nullable();
export type RoomDeviceDeployment = z.infer<typeof RoomDeviceDeploymentSchema>;

export const RoomDeviceBundleSchema = z.object({
	deployment: RoomDeviceDeploymentSchema,
	/** Which characters have which slots reserved */
	slotOccupancy: z.record(z.string(), CharacterIdSchema),
});
export type RoomDeviceBundle = z.infer<typeof RoomDeviceBundleSchema>;

export const RoomDeviceLinkSchema = z.object({
	device: ItemIdSchema,
	slot: z.string(),
});
export type RoomDeviceLink = z.infer<typeof RoomDeviceLinkSchema>;

export const LockBundleSchema = z.object({
	locked: z.object({
		/** Id of the character that locked the item */
		id: CharacterIdSchema,
		/** Name of the character that locked the item */
		name: z.string(),
		/** Time the item was locked */
		time: z.number(),
	}).optional(),
	hidden: z.discriminatedUnion('side', [
		z.object({
			side: z.literal('server'),
			/** Password used to lock the item */
			password: z.string().optional(),
		}),
		z.object({
			side: z.literal('client'),
			/** Whether the item has a password */
			hasPassword: z.boolean().optional(),
		}),
	]).optional(),
});
export type LockBundle = z.infer<typeof LockBundleSchema>;

/**
 * Serializable data bundle containing information about an item.
 * Used for storing appearance or room data in database and for transferring it to the clients.
 */
export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: ItemColorBundleSchema.or(z.array(HexRGBAColorStringSchema)).optional(),
	moduleData: z.record(z.unknown()).optional(),
	/** Room device specific data */
	roomDeviceData: RoomDeviceBundleSchema.optional(),
	/** Room device this part is linked to, only present for `roomDeviceWearablePart` */
	roomDeviceLink: RoomDeviceLinkSchema.optional(),
	/** Lock specific data */
	lockData: LockBundleSchema.optional(),
});
export type ItemBundle = z.infer<typeof ItemBundleSchema>;

/**
 * Data describing an item configuration as a template.
 * Used for creating a new item from the template with matching configuration.
 */
export const ItemTemplateSchema = z.object({
	asset: AssetIdSchema,
	templateName: z.string().optional(),
	color: ItemColorBundleSchema.optional(),
});
export type ItemTemplate = z.infer<typeof ItemTemplateSchema>;

export type IItemLoadContext = {
	assetManager: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
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

interface ItemBaseProps<Type extends AssetType = AssetType> {
	readonly assetManager: AssetManager;
	readonly id: ItemId;
	readonly asset: Asset<Type>;
	readonly color: Immutable<ItemColorBundle>;
}

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
abstract class ItemBase<Type extends AssetType = AssetType> implements ItemBaseProps<Type> {
	public readonly assetManager: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset<Type>;
	public readonly color: Immutable<ItemColorBundle>;

	public get type(): Type {
		return this.asset.type;
	}

	public isType<T extends AssetType>(kind: T): this is Item<T> {
		return this.asset.isType(kind);
	}

	public isWearable(): this is Item<WearableAssetType> {
		return this.asset.isWearable();
	}

	protected constructor(props: ItemBaseProps<Type>, overrideProps?: Partial<ItemBaseProps<Type>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.id = overrideProps?.id ?? props.id;
		this.asset = overrideProps?.asset ?? props.asset;
		this.color = overrideProps?.color ?? props.color;
	}

	protected static _parseBundle<Type extends AssetType = AssetType>(asset: Asset<Type>, bundle: ItemBundle, context: IItemLoadContext): ItemBaseProps<Type> {
		Assert(asset.id === bundle.asset);
		return {
			assetManager: context.assetManager,
			id: bundle.id,
			asset,
			color: ItemBase._loadColorBundle(asset, bundle.color),
		};
	}

	protected abstract withProps(overrideProps: Partial<ItemBaseProps<Type>>): Item<Type>;

	public exportToBundle(options: IExportOptions): ItemBundle {
		let moduleData: ItemBundle['moduleData'];
		if (this.getModules().size > 0) {
			moduleData = {};
			for (const [name, module] of this.getModules().entries()) {
				moduleData[name] = module.exportData(options);
			}
		}

		return {
			id: this.id,
			asset: this.asset.id,
			color: this.exportColorToBundle(),
			moduleData,
		};
	}

	public exportColorToBundle(): ItemColorBundle | undefined {
		if (!this.isType('personal') && !this.isType('roomDevice'))
			return undefined;
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return undefined;

		let hasKey = false;
		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			result[key] = value;
			hasKey = true;
		}
		return hasKey ? result : undefined;
	}

	public containerChanged(items: AppearanceItems, isCharacter: boolean): Item<Type> {
		Assert(this.isType(this.type));
		if (!isCharacter)
			return this;

		return this._overrideColors(items);
	}

	public getColorOverrides(items: AppearanceItems): null | Partial<Record<string, ColorGroupResult>> {
		if (!this.isType('personal'))
			return null;
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return null;

		const { overrideColorKey } = this.getProperties();
		if (overrideColorKey.size === 0)
			return null;

		let hasGroup = false;
		const result: Record<string, ColorGroupResult> = {};
		for (const key of Object.keys(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			if (!overrideColorKey.has(key))
				continue;

			const groupColor = this._resolveColorGroup(items, key, def);
			if (groupColor == null)
				continue;

			result[key] = groupColor;
			hasGroup = true;
		}
		return hasGroup ? result : null;
	}

	public validate(context: IItemValidationContext): AppearanceValidationResult {
		// Check the asset can actually be worn
		if (context.location === 'worn' && (!this.isWearable() || (this.isType('personal') && this.asset.definition.wearable === false)))
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		// Check bodyparts are worn
		if (this.isType('personal') && this.asset.definition.bodypart != null && context.location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		for (const module of this.getModules().values()) {
			const r = module.validate(context);
			if (!r.success)
				return r;
		}

		return { success: true };
	}

	/** Returns if this item can be transferred between inventories */
	public canBeTransferred(): boolean {
		// No transfering bodyparts, thank you
		if (this.isType('personal') && this.asset.definition.bodypart)
			return false;

		return true;
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: ItemColorBundle): Item<Type> {
		return this.withProps({
			color: ItemBase._loadColorBundle(this.asset, color),
		});
	}

	@MemoizeNoArg
	public getModules(): ReadonlyMap<string, IItemModule> {
		return new Map();
	}

	public getModuleItems(moduleName: string): AppearanceItems {
		return this.getModules().get(moduleName)?.getContents() ?? [];
	}

	public moduleAction(_context: AppearanceModuleActionContext, _moduleName: string, _action: ItemModuleAction): Item<Type> | null {
		return null;
	}

	public setModuleItems(_moduleName: string, _items: AppearanceItems): Item<Type> | null {
		return null;
	}

	@MemoizeNoArg
	public getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = (this.isWearable()) ? [this.asset.definition] : [];

		return propertyParts;
	}

	@MemoizeNoArg
	public getProperties(): AssetPropertiesIndividualResult {
		return this.getPropertiesParts()
			.reduce(MergeAssetPropertiesIndividual, CreateAssetPropertiesIndividualResult());
	}

	private _overrideColors(items: AppearanceItems): Item<Type> {
		Assert(this.isType(this.type));
		if (!this.isType('personal'))
			return this;
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return this;

		const overrides = this.getColorOverrides(items);
		if (!overrides)
			return this;

		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			const override = overrides[key];
			if (override == null)
				continue;

			result[key] = LimitColorAlpha(override.color, def.minAlpha) ?? value;
		}
		return this.changeColor(result);
	}

	/**
	 * Color resolution order:
	 * 1. Self (if it is not an inherited color)
	 * 2. Closest item before self that has this color group (if it is not an inherited color)
	 * 3. Closest item after self that has this color group (if it is not an inherited color)
	 * 4. Closest item from self (inclusive) that has this color group and it has an inherited color
	 */
	protected _resolveColorGroup(items: AppearanceItems, ignoreKey: string, { group }: Immutable<AssetColorization>): ColorGroupResult | undefined {
		Assert(this.isType(this.type));
		if (!group)
			return undefined;

		const selfResult = this._getColorByGroup(group, ignoreKey);
		if (selfResult?.[0] === 'primary')
			return { item: this, colorization: selfResult[1], color: selfResult[2] };

		let color: ColorGroupResult | undefined;
		let colorInherited: ColorGroupResult | undefined = selfResult ? { item: this, colorization: selfResult[1], color: selfResult[2] } : undefined;
		let foundSelf = false;
		for (const item of items) {
			if (item.id === this.id) {
				if (color)
					return color;

				foundSelf = true;
				continue;
			}

			const result = item._getColorByGroup(group);
			if (result == null)
				continue;

			const [resultKey, colorization, resultColor] = result;
			switch (resultKey) {
				case 'primary':
					if (foundSelf)
						return { item, colorization, color: resultColor };

					color = { item, colorization, color: resultColor };
					break;
				case 'inherited':
					if (!colorInherited || !foundSelf)
						colorInherited = { item, colorization, color: resultColor };
					break;
			}
		}
		return color ?? colorInherited;
	}

	private _getColorByGroup(group: string, ignoreKey?: string): null | ['primary' | 'inherited', Immutable<AssetColorization>, HexRGBAColorString] {
		const { overrideColorKey, excludeFromColorInheritance } = this.getProperties();
		let inherited: [Immutable<AssetColorization>, HexRGBAColorString] | undefined;
		if (this.isType('personal') && this.asset.definition.colorization) {
			for (const [key, value] of Object.entries(this.asset.definition.colorization)) {
				if (value.group !== group || !this.color[key])
					continue;
				if (key === ignoreKey || excludeFromColorInheritance.has(key))
					continue;

				if (!overrideColorKey.has(key))
					return ['primary', value, this.color[key]];

				if (!inherited)
					inherited = [value, this.color[key]];
			}
		}
		return inherited ? ['inherited', ...inherited] : null;
	}

	private static _loadColorBundle(asset: Asset, color: ItemColorBundle | HexRGBAColorString[] = {}): ItemColorBundle {
		const colorization = (asset.isType('personal') || asset.isType('roomDevice')) ? (asset.definition.colorization ?? {}) : {};
		if (Array.isArray(color)) {
			const keys = Object.keys(colorization);
			const fixup: Writeable<ItemColorBundle> = {};
			color.forEach((value, index) => {
				if (index < keys.length)
					fixup[keys[index]] = value;
			});
			color = fixup;
		}
		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(colorization)) {
			if (value.name == null)
				continue;

			result[key] = LimitColorAlpha(color[key] ?? value.default, value.minAlpha);
		}
		return result;
	}
}

function LimitColorAlpha(color: HexRGBAColorString, minAlpha: number = 255): HexRGBAColorString {
	if (color.length === 7)
		return color;

	if (minAlpha >= 255)
		return color.substring(0, 7) as HexRGBAColorString;

	const alpha = Math.max(parseInt(color.substring(7), 16), minAlpha);
	return color.substring(0, 7) + alpha.toString(16).padStart(2, '0') as HexRGBAColorString;
}

export function FilterItemType<T extends AssetType>(type: T): (item: Item) => item is Item<T> {
	return (item): item is Item<T> => item.isType(type);
}

export function FilterItemWearable(item: Item): item is Item<WearableAssetType> {
	return item.isWearable();
}

export type IItemLocationDescriptor = 'worn' | 'attached' | 'stored' | 'roomInventory';

interface ItemPersonalProps extends ItemBaseProps<'personal'> {
	readonly modules: ReadonlyMap<string, IItemModule<AssetProperties>>;
}

export class ItemPersonal extends ItemBase<'personal'> implements ItemPersonalProps {
	public readonly modules: ReadonlyMap<string, IItemModule<AssetProperties>>;

	protected constructor(props: ItemPersonalProps, overrideProps?: Partial<ItemPersonalProps>) {
		super(props, overrideProps);
		this.modules = overrideProps?.modules ?? props.modules;
	}

	protected override withProps(overrideProps: Partial<ItemPersonalProps>): ItemPersonal {
		return new ItemPersonal(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'personal'>, bundle: ItemBundle, context: IItemLoadContext): ItemPersonal {
		// Load modules
		const modules = new Map<string, IItemModule<AssetProperties>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<AssetProperties>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		return new ItemPersonal({
			...(ItemBase._parseBundle(asset, bundle, context)),
			modules,
		});
	}

	public resolveColor(items: AppearanceItems, colorizationKey: string): HexRGBAColorString | undefined {
		const colorization = this.asset.definition.colorization?.[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return this._resolveColorGroup(items, colorizationKey, colorization)?.color ?? colorization.default;
	}

	public getColorRibbon(items: AppearanceItems): HexRGBAColorString | undefined {
		return this.resolveColor(
			items,
			this.asset.definition.colorRibbonGroup ??
			first(Object.keys(this.asset.definition.colorization ?? {})) ??
			'',
		);
	}

	public override getModules(): ReadonlyMap<string, IItemModule<AssetProperties>> {
		return this.modules;
	}

	public override moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): ItemPersonal | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	public override setModuleItems(moduleName: string, items: AppearanceItems): ItemPersonal | null {
		const moduleResult = this.modules.get(moduleName)?.setContents(items);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		return [
			...super.getPropertiesParts(),
			...Array.from(this.modules.values()).flatMap((m) => m.getProperties()),
		];
	}
}

interface ItemRoomDeviceProps extends ItemBaseProps<'roomDevice'> {
	readonly deployment: Immutable<RoomDeviceDeployment>;
	readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties>>;
}

export class ItemRoomDevice extends ItemBase<'roomDevice'> implements ItemRoomDeviceProps {
	public readonly deployment: Immutable<RoomDeviceDeployment>;
	public readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	public readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties>>;

	protected constructor(props: ItemRoomDeviceProps, overrideProps: Partial<ItemRoomDeviceProps> = {}) {
		super(props, overrideProps);
		this.deployment = overrideProps.deployment !== undefined ? overrideProps.deployment : props.deployment;
		this.slotOccupancy = overrideProps?.slotOccupancy ?? props.slotOccupancy;
		this.modules = overrideProps?.modules ?? props.modules;
	}

	protected override withProps(overrideProps: Partial<ItemRoomDeviceProps>): ItemRoomDevice {
		return new ItemRoomDevice(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'roomDevice'>, bundle: ItemBundle, context: IItemLoadContext): ItemRoomDevice {
		// Load modules
		const modules = new Map<string, IItemModule<RoomDeviceProperties>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<RoomDeviceProperties>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		// Load device-specific data
		const roomDeviceData: RoomDeviceBundle = bundle.roomDeviceData ?? {
			deployment: null,
			slotOccupancy: {},
		};

		const deployment = roomDeviceData.deployment;

		const slotOccupancy = new Map<string, CharacterId>();
		// Skip occupied slots if we are not deployed
		if (deployment != null) {
			for (const slot of Object.keys(asset.definition.slots)) {
				if (roomDeviceData.slotOccupancy[slot] != null) {
					slotOccupancy.set(slot, roomDeviceData.slotOccupancy[slot]);
				}
			}
		}

		return new ItemRoomDevice({
			...(ItemBase._parseBundle(asset, bundle, context)),
			modules,
			deployment,
			slotOccupancy,
		});
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		// Deployed room devices must be in a room
		if (this.deployment != null && context.location !== 'roomInventory')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		return { success: true };
	}

	public override exportToBundle(options: IExportOptions): ItemBundle & { roomDeviceData: RoomDeviceBundle; } {
		const slotOccupancy: RoomDeviceBundle['slotOccupancy'] = {};
		for (const [slot, character] of this.slotOccupancy.entries()) {
			slotOccupancy[slot] = character;
		}
		return {
			...super.exportToBundle(options),
			roomDeviceData: {
				deployment: this.deployment,
				slotOccupancy,
			},
		};
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeDeployment(newDeployment: RoomDeviceDeployment): ItemRoomDevice {
		return this.withProps({
			deployment: newDeployment,
		});
	}

	public changeSlotOccupancy(slot: string, character: CharacterId | null): ItemRoomDevice | null {
		// The slot must exist and the device must be deployed
		if (this.asset.definition.slots[slot] == null || this.deployment == null)
			return null;

		const slotOccupancy = new Map(this.slotOccupancy);
		if (character == null) {
			slotOccupancy.delete(slot);
		} else {
			slotOccupancy.set(slot, character);
		}

		return this.withProps({
			slotOccupancy,
		});
	}

	public resolveColor(colorizationKey: string): HexRGBAColorString | undefined {
		const colorization = this.asset.definition.colorization?.[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return colorization.default;
	}

	public getColorRibbon(): HexRGBAColorString | undefined {
		return this.resolveColor(
			this.asset.definition.colorRibbonGroup ??
			first(Object.keys(this.asset.definition.colorization ?? {})) ??
			'',
		);
	}

	public override getModules(): ReadonlyMap<string, IItemModule<RoomDeviceProperties>> {
		return this.modules;
	}

	public override moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): ItemRoomDevice | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	public override setModuleItems(moduleName: string, items: AppearanceItems): ItemRoomDevice | null {
		const moduleResult = this.modules.get(moduleName)?.setContents(items);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	@MemoizeNoArg
	public getRoomDevicePropertiesParts(): readonly Immutable<RoomDeviceProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = [
			...Array.from(this.modules.values()).flatMap((m) => m.getProperties()),
		];

		return propertyParts;
	}

	@MemoizeNoArg
	public getRoomDeviceProperties(): RoomDevicePropertiesResult {
		return this.getRoomDevicePropertiesParts()
			.reduce(MergeRoomDeviceProperties, CreateRoomDevicePropertiesResult());
	}
}

interface ItemRoomDeviceWearablePartProps extends ItemBaseProps<'roomDeviceWearablePart'> {
	readonly roomDeviceLink: Immutable<RoomDeviceLink> | null;
	readonly roomDevice: ItemRoomDevice | null;
}
export class ItemRoomDeviceWearablePart extends ItemBase<'roomDeviceWearablePart'> implements ItemRoomDeviceWearablePartProps {
	public readonly roomDeviceLink: Immutable<RoomDeviceLink> | null;
	public readonly roomDevice: ItemRoomDevice | null;

	protected constructor(props: ItemRoomDeviceWearablePartProps, overrideProps?: Partial<ItemRoomDeviceWearablePartProps>) {
		super(props, overrideProps);

		this.roomDeviceLink = overrideProps?.roomDeviceLink !== undefined ? overrideProps.roomDeviceLink : props.roomDeviceLink;
		this.roomDevice = overrideProps?.roomDevice !== undefined ? overrideProps.roomDevice : props.roomDevice;
	}

	protected override withProps(overrideProps: Partial<ItemRoomDeviceWearablePartProps>): ItemRoomDeviceWearablePart {
		return new ItemRoomDeviceWearablePart(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'roomDeviceWearablePart'>, bundle: ItemBundle, context: IItemLoadContext): ItemRoomDeviceWearablePart {
		return new ItemRoomDeviceWearablePart({
			...(ItemBase._parseBundle(asset, bundle, context)),
			roomDeviceLink: bundle.roomDeviceLink ?? null,
			roomDevice: null,
		});
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		// Room device wearable parts must be worn
		if (context.location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		// We must have a valid link
		if (this.roomDeviceLink == null)
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};

		const device = context.roomState?.items.find((item) => item.isType('roomDevice') && item.id === this.roomDeviceLink?.device);
		if (device == null || device !== this.roomDevice) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}

		return { success: true };
	}

	/** Returns if this item can be transferred between inventories */
	public override canBeTransferred(): boolean {
		return false;
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		return {
			...super.exportToBundle(options),
			roomDeviceLink: this.roomDeviceLink ?? undefined,
		};
	}

	public withLink(device: ItemRoomDevice, slot: string): ItemRoomDeviceWearablePart {
		return this.withProps({
			roomDeviceLink: {
				device: device.id,
				slot,
			},
			roomDevice: device,
		});
	}

	public updateRoomStateLink(roomDevice: ItemRoomDevice): ItemRoomDeviceWearablePart {
		Assert(this.roomDeviceLink?.device === roomDevice.id);
		return this.withProps({
			roomDevice,
		});
	}

	public resolveColor(colorizationKey: string, roomDevice: ItemRoomDevice | null): HexRGBAColorString | undefined {
		return roomDevice?.resolveColor(colorizationKey);
	}

	public getColorRibbon(roomDevice: ItemRoomDevice | null): HexRGBAColorString | undefined {
		return roomDevice?.getColorRibbon();
	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const deviceProperties: RoomDevicePropertiesResult | undefined = this.roomDevice?.getRoomDeviceProperties();

		return [
			...super.getPropertiesParts(),
			...(deviceProperties != null ? GetPropertiesForSlot(deviceProperties, this.roomDeviceLink!.slot) : []),
		];
	}
}

export const ItemLockActionSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('lock'),
		password: z.string().optional(),
	}),
	z.object({
		action: z.literal('unlock'),
		password: z.string().optional(),
		clearLastPassword: z.boolean().optional(),
	}),
]);
export type IItemLockAction = z.infer<typeof ItemLockActionSchema>;

interface ItemLockProps extends ItemBaseProps<'lock'> {
	readonly lockData: Immutable<LockBundle> | undefined;
}
export class ItemLock extends ItemBase<'lock'> {
	public readonly lockData: Immutable<LockBundle> | undefined;

	public get hasPassword(): boolean {
		switch (this.lockData?.hidden?.side) {
			case 'client':
				return this.lockData.hidden.hasPassword ?? false;
			case 'server':
				return this.lockData.hidden.password != null;
			default:
				return false;
		}
	}

	protected constructor(props: ItemLockProps, overrideProps: Partial<ItemLockProps> = {}) {
		super(props, overrideProps);
		this.lockData = 'lockData' in overrideProps ? overrideProps.lockData : props.lockData;
	}

	protected override withProps(overrideProps: Partial<ItemLockProps>): ItemLock {
		return new ItemLock(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'lock'>, bundle: ItemBundle, context: IItemLoadContext): ItemLock {
		const lockData: LockBundle | undefined = bundle.lockData;
		if (context.doLoadTimeCleanup && lockData?.hidden != null) {
			switch (lockData.hidden.side) {
				case 'client':
					if (asset.definition.password == null && lockData.hidden.hasPassword != null) {
						context.logger?.warning(`Lock ${bundle.id} has hidden password`);
						delete lockData.hidden.hasPassword;
					} else if (asset.definition.password != null && lockData.hidden.hasPassword == null) {
						context.logger?.warning(`Lock ${bundle.id} has no hidden password`);
						delete lockData.locked;
					}
					break;
				case 'server':
					if (lockData.hidden.password != null && !ItemLock._validatePassword(asset, lockData.hidden.password, context.logger?.prefixMessages(`Lock ${bundle.id}`))) {
						delete lockData.hidden.password;
					}
					if (asset.definition.password != null && lockData.hidden?.password == null && lockData.locked != null) {
						context.logger?.warning(`Lock ${bundle.id} is locked but has no hidden password`);
						delete lockData.locked;
					}
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				delete lockData.hidden;
			}
		}

		return new ItemLock({
			...(ItemBase._parseBundle(asset, bundle, context)),
			lockData,
		});
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		if (options.clientOnly && this.lockData?.hidden?.side === 'server') {
			return {
				...super.exportToBundle(options),
				lockData: {
					...this.lockData,
					hidden: {
						side: 'client',
						hasPassword: this.lockData.hidden.password ? true : undefined,
					},
				},
			};
		}
		return {
			...super.exportToBundle(options),
			lockData: this.lockData,
		};
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		if (context.location === 'worn') {
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};
		}

		return { success: true };
	}

	public override getModuleItems(_moduleName: string): AppearanceItems {
		return [];
	}

	public override setModuleItems(_moduleName: string, _items: AppearanceItems): null {
		return null;
	}

	public isLocked(): boolean {
		return this.lockData?.locked != null;
	}

	public getLockProperties(): AssetLockProperties {
		if (this.isLocked())
			return this.asset.definition.locked ?? {};

		return this.asset.definition.unlocked ?? {};
	}

	public lockAction(context: AppearanceModuleActionContext, action: IItemLockAction): ItemLock | null {
		const playerRestrictionManager = context.processingContext.getPlayerRestrictionManager();
		const isSelfAction = context.target.type === 'character' && context.target.character.id === context.processingContext.player.id;
		const properties = this.getLockProperties();

		if (action.password != null && !ItemLock._validatePassword(this.asset, action.password)) {
			return null;
		}

		// Locks can prevent interaction from player (unless in safemode)
		if (properties.blockSelf && isSelfAction && !playerRestrictionManager.isInSafemode()) {
			context.reject({
				type: 'lockInteractionPrevented',
				moduleAction: action.action,
				reason: 'blockSelf',
				asset: this.asset.id,
			});
			return null;
		}

		switch (action.action) {
			case 'lock':
				return this.lock(context, action);
			case 'unlock':
				return this.unlock(context, action);
		}
		AssertNever(action);
	}

	public lock({ messageHandler, processingContext, reject }: AppearanceModuleActionContext, { password }: IItemLockAction & { action: 'lock'; }): ItemLock | null {
		if (this.isLocked())
			return null;

		const rejectMissingPassword = () => {
			reject({
				type: 'lockInteractionPrevented',
				moduleAction: 'lock',
				reason: 'noStoredPassword',
				asset: this.asset.id,
			});
			return null;
		};

		let hidden: LockBundle['hidden'] | undefined;
		if (this.asset.definition.password != null && password == null) {
			switch (this.lockData?.hidden?.side) {
				case 'client':
					if (!this.lockData.hidden.hasPassword) {
						return rejectMissingPassword();
					}
					hidden = { side: 'client', hasPassword: true };
					break;
				case 'server':
					if (this.lockData.hidden.password == null) {
						return rejectMissingPassword();
					}
					hidden = { side: 'server', password: this.lockData.hidden.password };
					break;
				default:
					return rejectMissingPassword();
			}
		} else if (password != null) {
			hidden = { side: 'server', password };
		}

		if (this.asset.definition.chat?.actionLock) {
			messageHandler({
				id: 'custom',
				customText: this.asset.definition.chat.actionLock,
			});
		}

		return this.withProps({
			lockData: {
				...this.lockData,
				hidden,
				locked: {
					id: processingContext.player.id,
					name: processingContext.player.name,
					time: Date.now(),
				},
			},
		});
	}

	public unlock({ messageHandler, failure, processingContext }: AppearanceModuleActionContext, { password, clearLastPassword }: IItemLockAction & { action: 'unlock'; }): ItemLock | null {
		const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
		if (!this.isLocked() || this.lockData == null)
			return null;

		if (this.asset.definition.password != null && !playerRestrictionManager.isInSafemode()) {
			if (password == null) {
				return null;
			} else if (this.lockData.hidden?.side === 'server' && password !== this.lockData.hidden.password) {
				failure({
					type: 'lockInteractionPrevented',
					moduleAction: 'unlock',
					reason: 'wrongPassword',
					asset: this.asset.id,
				});
			}
		}

		if (this.asset.definition.chat?.actionUnlock) {
			messageHandler({
				id: 'custom',
				customText: this.asset.definition.chat.actionUnlock,
			});
		}

		const lockData: LockBundle = {
			...this.lockData,
			hidden: this.lockData?.hidden ? { ...this.lockData.hidden } : undefined,
			locked: undefined,
		};
		if (clearLastPassword && lockData.hidden) {
			switch (lockData.hidden.side) {
				case 'client':
					delete lockData.hidden.hasPassword;
					break;
				case 'server':
					delete lockData.hidden.password;
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				lockData.hidden = undefined;
			}
		}

		return this.withProps({
			lockData,
		});
	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const parentResult = super.getPropertiesParts();

		if (this.isLocked()) {
			return [
				...parentResult,
				{
					blockAddRemove: true,
				},
			];
		}

		return parentResult;
	}

	private static _validatePassword(asset: Asset<'lock'>, password: string, logger?: Logger): boolean {
		const def = asset.definition.password;
		if (def == null) {
			logger?.warning(`has a hidden password but the asset does not define a password`);
			return false;
		}
		if (typeof def.length === 'number') {
			if (password.length !== def.length) {
				logger?.warning(`has a hidden password longer than the asset's password length`);
				return false;
			}
		} else if (password.length < def.length[0] || password.length > def.length[1]) {
			logger?.warning(`has a hidden password outside of the asset's password length range`);
			return false;
		}
		switch (def.format) {
			case 'numeric':
				if (password.match(/[^0-9]/)) {
					logger?.warning(`has a hidden password that is not numeric`);
					return false;
				}
				break;
			case 'letters':
				if (password.match(/[^a-zA-Z]/)) {
					logger?.warning(`has a hidden password that is not letters`);
					return false;
				}
				break;
			case 'alphanumeric':
				if (password.match(/[^a-zA-Z0-9]/)) {
					logger?.warning(`has a hidden password that is not alphanumeric`);
					return false;
				}
				break;
			case 'text':
				break;
			default:
				AssertNever(def.format);
		}
		return true;
	}
}

export type ItemTypeMap =
	Satisfies<
		{
			personal: ItemPersonal;
			roomDevice: ItemRoomDevice;
			roomDeviceWearablePart: ItemRoomDeviceWearablePart;
			lock: ItemLock;
		},
		{
			[type in AssetType]: ItemBase<type>;
		}
	>;

export type Item<Type extends AssetType = AssetType> = ItemTypeMap[Type];

export function LoadItemFromBundle<T extends AssetType>(asset: Asset<T>, bundle: ItemBundle, context: IItemLoadContext): Item<T> {
	const type = asset.type;
	switch (type) {
		case 'personal':
			Assert(asset.isType('personal'));
			// @ts-expect-error: Type specialized manually
			return ItemPersonal.loadFromBundle(asset, bundle, context);
		case 'roomDevice':
			Assert(asset.isType('roomDevice'));
			// @ts-expect-error: Type specialized manually
			return ItemRoomDevice.loadFromBundle(asset, bundle, context);
		case 'roomDeviceWearablePart':
			Assert(asset.isType('roomDeviceWearablePart'));
			// @ts-expect-error: Type specialized manually
			return ItemRoomDeviceWearablePart.loadFromBundle(asset, bundle, context);
		case 'lock':
			Assert(asset.isType('lock'));
			// @ts-expect-error: Type specialized manually
			return ItemLock.loadFromBundle(asset, bundle, context);
	}
	AssertNever(type);
}
