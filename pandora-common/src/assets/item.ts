import { Immutable } from 'immer';
import _, { first } from 'lodash';
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

export const ItemColorBundleSchema = z.record(z.string(), HexRGBAColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

export const RoomDeviceDeploymentSchema = z.object({
	x: z.number(),
	y: z.number(),
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

export type IItemLoadContext = {
	assetManager: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
};

export type ColorGroupResult = {
	item: Item;
	colorization: Immutable<AssetColorization>;
	color: HexRGBAColorString;
};

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
abstract class ItemBase<Type extends AssetType = AssetType> {
	public readonly assetManager: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset<Type>;
	public readonly color: Immutable<ItemColorBundle>;
	public readonly modules: ReadonlyMap<string, IItemModule>;

	public get type(): Type {
		return this.asset.type;
	}

	public isType<T extends AssetType>(kind: T): this is Item<T> {
		return this.asset.isType(kind);
	}

	public isWearable(): this is Item<WearableAssetType> {
		return this.asset.isWearable();
	}

	constructor(id: ItemId, asset: Asset<Type>, bundle: ItemBundle, context: IItemLoadContext) {
		this.assetManager = context.assetManager;
		this.id = id;
		this.asset = asset;
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
		// Load modules
		const modules = new Map<string, IItemModule>();
		if (asset.isType('personal')) {
			for (const moduleName of Object.keys(asset.definition.modules ?? {})) {
				modules.set(moduleName, LoadItemModule(asset, moduleName, bundle.moduleData?.[moduleName], context));
			}
		}
		this.modules = modules;
		// Load color from bundle
		this.color = this._loadColor(bundle.color);
	}

	public exportToBundle(options: IExportOptions): ItemBundle {
		let moduleData: ItemBundle['moduleData'];
		if (this.modules.size > 0) {
			moduleData = {};
			for (const [name, module] of this.modules.entries()) {
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

	public validate(location: IItemLocationDescriptor): AppearanceValidationResult {
		// Check the asset can actually be worn
		if (location === 'worn' && (!this.isWearable() || (this.isType('personal') && this.asset.definition.wearable === false)))
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		// Check bodyparts are worn
		if (this.isType('personal') && this.asset.definition.bodypart != null && location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		for (const module of this.modules.values()) {
			const r = module.validate(location);
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
		const bundle = this.exportToBundle({});
		bundle.color = _.cloneDeep(color);
		return CreateItem(this.id, this.asset, bundle, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): Item | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action);
		if (!moduleResult)
			return null;
		const bundle = this.exportToBundle({});
		return CreateItem(this.id, this.asset, {
			...bundle,
			moduleData: {
				...bundle.moduleData,
				[moduleName]: moduleResult.exportData({}),
			},
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public getModuleItems(moduleName: string): AppearanceItems {
		return this.modules.get(moduleName)?.getContents() ?? [];
	}

	public setModuleItems(moduleName: string, items: AppearanceItems): Item | null {
		const moduleResult = this.modules.get(moduleName)?.setContents(items);
		if (!moduleResult)
			return null;
		const bundle = this.exportToBundle({});
		return CreateItem(this.id, this.asset, {
			...bundle,
			moduleData: {
				...bundle.moduleData,
				[moduleName]: moduleResult.exportData({}),
			},
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	@MemoizeNoArg
	public getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = (this.isWearable()) ? [this.asset.definition] : [];
		propertyParts.push(...Array.from(this.modules.values()).map((m) => m.getProperties()));

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

	private _loadColor(color: ItemColorBundle | HexRGBAColorString[] = {}): ItemColorBundle {
		const colorization = (this.isType('personal') || this.isType('roomDevice')) ? (this.asset.definition.colorization ?? {}) : {};
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

export class ItemPersonal extends ItemBase<'personal'> {
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
}

export class ItemRoomDevice extends ItemBase<'roomDevice'> {
	public readonly deployment: Immutable<RoomDeviceDeployment>;
	public readonly slotOccupancy: ReadonlyMap<string, CharacterId>;

	constructor(id: ItemId, asset: Asset<'roomDevice'>, bundle: ItemBundle, context: IItemLoadContext) {
		super(id, asset, bundle, context);

		const roomDeviceData: RoomDeviceBundle = bundle.roomDeviceData ?? {
			deployment: null,
			slotOccupancy: {},
		};

		this.deployment = roomDeviceData.deployment;

		const slotOccupancy = new Map<string, CharacterId>();
		// Skip occupied slots if we are not deployed
		if (this.deployment != null) {
			for (const slot of Object.keys(asset.definition.slots)) {
				if (roomDeviceData.slotOccupancy[slot] != null) {
					slotOccupancy.set(slot, roomDeviceData.slotOccupancy[slot]);
				}
			}
		}
		this.slotOccupancy = slotOccupancy;
	}

	public override validate(location: IItemLocationDescriptor): AppearanceValidationResult {
		const parentResult = super.validate(location);
		if (!parentResult.success)
			return parentResult;

		// Deployed room devices must be in a room
		if (this.deployment != null && location !== 'roomInventory')
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
		const bundle = this.exportToBundle({});
		bundle.roomDeviceData.deployment = newDeployment;
		return CreateItem(this.id, this.asset, bundle, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public changeSlotOccupancy(slot: string, character: CharacterId | null): ItemRoomDevice | null {
		// The slot must exist and the device must be deployed
		if (this.asset.definition.slots[slot] == null || this.deployment == null)
			return null;

		const bundle = this.exportToBundle({});
		if (character == null) {
			delete bundle.roomDeviceData.slotOccupancy[slot];
		} else {
			bundle.roomDeviceData.slotOccupancy[slot] = character;
		}
		return CreateItem(this.id, this.asset, bundle, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
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
}

export class ItemRoomDeviceWearablePart extends ItemBase<'roomDeviceWearablePart'> {
	public readonly roomDeviceLink: Immutable<RoomDeviceLink> | null;

	constructor(id: ItemId, asset: Asset<'roomDeviceWearablePart'>, bundle: ItemBundle, context: IItemLoadContext) {
		super(id, asset, bundle, context);

		this.roomDeviceLink = bundle.roomDeviceLink ?? null;
	}

	public override validate(location: IItemLocationDescriptor): AppearanceValidationResult {
		const parentResult = super.validate(location);
		if (!parentResult.success)
			return parentResult;

		// Room device wearable parts must be worn
		if (location !== 'worn')
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

	public withLink(link: RoomDeviceLink): ItemRoomDeviceWearablePart {
		const bundle = this.exportToBundle({});
		bundle.roomDeviceLink = link;
		return CreateItem(this.id, this.asset, bundle, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public resolveColor(colorizationKey: string, roomDevice: ItemRoomDevice | null): HexRGBAColorString | undefined {
		return roomDevice?.resolveColor(colorizationKey);
	}

	public getColorRibbon(roomDevice: ItemRoomDevice | null): HexRGBAColorString | undefined {
		return roomDevice?.getColorRibbon();
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

export class ItemLock extends ItemBase<'lock'> {
	public readonly lockData: Immutable<LockBundle> | undefined;

	constructor(id: ItemId, asset: Asset<'lock'>, bundle: ItemBundle, context: IItemLoadContext) {
		super(id, asset, bundle, context);
		const lockData = bundle.lockData;
		if (context.doLoadTimeCleanup && lockData?.hidden != null) {
			switch (lockData.hidden.side) {
				case 'client':
					if (asset.definition.password == null && lockData.hidden.hasPassword != null) {
						context.logger?.warning(`Lock ${id} has hidden password`);
						delete lockData.hidden.hasPassword;
					} else if (asset.definition.password != null && lockData.hidden.hasPassword == null) {
						context.logger?.warning(`Lock ${id} has no hidden password`);
						delete lockData.locked;
					}
					break;
				case 'server':
					if (lockData.hidden.password != null && !this._validatePassword(lockData.hidden.password, context.logger)) {
						delete lockData.hidden.password;
					}
					if (asset.definition.password != null && lockData.hidden?.password == null && lockData.locked != null) {
						context.logger?.warning(`Lock ${id} is locked but has no hidden password`);
						delete lockData.locked;
					}
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				delete lockData.hidden;
			}
		}
		this.lockData = lockData;
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		return {
			...super.exportToBundle(options),
			lockData: this.lockData,
		};
	}

	public override validate(location: IItemLocationDescriptor): AppearanceValidationResult {
		if (location === 'worn') {
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
		const isSelfAction = context.target.type === 'character' && context.target.character.id === context.player.character.id;
		const properties = this.getLockProperties();

		if (action.password != null && !this._validatePassword(action.password)) {
			return null;
		}

		// Locks can prevent interaction from player (unless in safemode)
		if (properties.blockSelf && isSelfAction && !context.player.isInSafemode()) {
			context.reject({
				type: 'lockIntereactionPrevented',
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

	public lock({ messageHandler, player }: AppearanceModuleActionContext, { password }: IItemLockAction & { action: 'lock'; }): ItemLock | null {
		if (this.isLocked())
			return null;

		let hidden: LockBundle['hidden'] | undefined;
		if (this.asset.definition.password != null && password == null) {
			switch (this.lockData?.hidden?.side) {
				case 'client':
					if (!this.lockData.hidden.hasPassword) {
						// TODO: reject no password
						return null;
					}
					hidden = { side: 'client', hasPassword: true };
					break;
				case 'server':
					if (this.lockData.hidden.password == null) {
						// TODO: reject no password
						return null;
					}
					hidden = { side: 'server', password };
					break;
				default:
					// TODO: reject no password
					return null;
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

		return new ItemLock(this.id, this.asset, {
			...super.exportToBundle({}),
			lockData: {
				...this.lockData,
				hidden,
				locked: {
					id: player.character.id,
					name: player.character.name,
					time: Date.now(),
				},
			},
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public unlock({ messageHandler }: AppearanceModuleActionContext, { password, clearLastPassword }: IItemLockAction & { action: 'unlock'; }): ItemLock | null {
		if (!this.isLocked() || this.lockData == null)
			return null;

		if (this.asset.definition.password != null) {
			if (password == null) {
				return null;
			} else if (this.lockData.hidden?.side === 'server' && password !== this.lockData.hidden.password) {
				// TODO: new type of reject for server side failures
				return null;
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

		return new ItemLock(this.id, this.asset, {
			...super.exportToBundle({}),
			lockData,
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
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

	private _validatePassword(password: string, logger?: Logger): boolean {
		const def = this.asset.definition.password;
		const id = this.id;
		if (def == null) {
			logger?.warning(`Lock ${id} has a hidden password but the asset does not define a password`);
			return false;
		}
		if (typeof def.length === 'number') {
			if (password.length !== def.length) {
				logger?.warning(`Lock ${id} has a hidden password longer than the asset's password length`);
				return false;
			}
		} else if (password.length < def.length[0] || password.length > def.length[1]) {
			logger?.warning(`Lock ${id} has a hidden password outside of the asset's password length range`);
			return false;
		}
		switch (def.format) {
			case 'numeric':
				if (password.match(/[^0-9]/)) {
					logger?.warning(`Lock ${id} has a hidden password that is not numeric`);
					return false;
				}
				break;
			case 'letters':
				if (password.match(/[^a-zA-Z]/)) {
					logger?.warning(`Lock ${id} has a hidden password that is not letters`);
					return false;
				}
				break;
			case 'alphanumeric':
				if (password.match(/[^a-zA-Z0-9]/)) {
					logger?.warning(`Lock ${id} has a hidden password that is not alphanumeric`);
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

export function CreateItem<Type extends AssetType>(id: ItemId, asset: Asset<Type>, bundle: ItemBundle, context: IItemLoadContext): Item<Type> {
	const type = asset.type;
	let result: Item;
	switch (type) {
		case 'personal':
			Assert(asset.isType('personal'));
			result = new ItemPersonal(id, asset, bundle, context);
			break;
		case 'roomDevice':
			Assert(asset.isType('roomDevice'));
			result = new ItemRoomDevice(id, asset, bundle, context);
			break;
		case 'roomDeviceWearablePart':
			Assert(asset.isType('roomDeviceWearablePart'));
			result = new ItemRoomDeviceWearablePart(id, asset, bundle, context);
			break;
		case 'lock':
			Assert(asset.isType('lock'));
			result = new ItemLock(id, asset, bundle, context);
			break;
		default:
			AssertNever(type);
	}
	// @ts-expect-error: The type is narrowed manually
	return result;
}
