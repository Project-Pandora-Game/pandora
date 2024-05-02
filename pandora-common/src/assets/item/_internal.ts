import type { Immutable } from 'immer';
import type { Writeable } from 'zod';

import type { HexRGBAColorString } from '../../validation';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { Asset } from '../asset';
import type { AssetManager } from '../assetManager';
import type { AssetColorization, AssetType, WearableAssetType } from '../definitions';
import type { ItemModuleAction } from '../modules';
import type { IExportOptions, IItemModule } from '../modules/common';
import type { ColorGroupResult, IItemLoadContext, IItemValidationContext, Item, ItemBundle, ItemColorBundle, ItemId, ItemTemplate } from './base';
import type { CharacterId } from '../../character';

import { Assert, MemoizeNoArg } from '../../utility';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from '../properties';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InternalItemTypeMap { }

export interface ItemBaseProps<Type extends AssetType = AssetType> {
	readonly assetManager: AssetManager;
	readonly id: ItemId;
	readonly asset: Asset<Type>;
	readonly spawnedBy: CharacterId;
	readonly color: Immutable<ItemColorBundle>;
	readonly name?: string;
	readonly description?: string;
}

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export abstract class ItemBase<Type extends AssetType = AssetType> implements ItemBaseProps<Type> {
	public readonly assetManager: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset<Type>;
	public readonly spawnedBy: CharacterId;
	public readonly color: Immutable<ItemColorBundle>;
	public readonly name?: string;
	public readonly description?: string;

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
		this.spawnedBy = overrideProps?.spawnedBy ?? props.spawnedBy;
		this.color = overrideProps?.color ?? props.color;
		this.name = (overrideProps && 'name' in overrideProps) ? overrideProps.name : props.name;
		this.description = (overrideProps && 'description' in overrideProps) ? overrideProps.description : props.description;
	}

	protected static _parseBundle<Type extends AssetType = AssetType>(asset: Asset<Type>, bundle: ItemBundle, context: IItemLoadContext): ItemBaseProps<Type> {
		Assert(asset.id === bundle.asset);
		return {
			assetManager: context.assetManager,
			id: bundle.id,
			asset,
			spawnedBy: bundle.spawnedBy,
			color: ItemBase._loadColorBundle(asset, bundle.color),
			name: bundle.name,
			description: bundle.description,
		};
	}

	protected abstract withProps(overrideProps: Partial<ItemBaseProps<Type>>): Item<Type>;

	public exportToTemplate(): ItemTemplate {
		let modules: ItemTemplate['modules'];
		if (this.getModules().size > 0) {
			modules = {};
			for (const [name, module] of this.getModules().entries()) {
				modules[name] = module.exportToTemplate();
			}
		}

		return {
			asset: this.asset.id,
			color: this.exportColorToBundle(),
			modules,
		};
	}

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
			spawnedBy: this.spawnedBy,
			color: this.exportColorToBundle(),
			name: this.name,
			description: this.description,
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
		// Check that the item's internal state is valid
		const properties = this.getProperties();
		for (const [flag, reason] of properties.stateFlagsRequirements.entries()) {
			if (!properties.stateFlags.has(flag)) {
				return {
					success: false,
					error: {
						problem: 'invalidState',
						asset: this.asset.id,
						itemName: this.name ?? '',
						reason,
					},
				};
			}
		}

		// Check the asset can actually be worn
		if (context.location === 'worn' && (!this.isWearable() || (this.isType('personal') && this.asset.definition.wearable === false)))
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};

		// Check bodyparts are worn
		if (this.isType('personal') && this.asset.definition.bodypart != null && context.location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
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
		// No transferring bodyparts, thank you
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

	/** Returns a new item with the passed name and description */
	public customize(newName: string, newDescription: string): Item<Type> {
		let name: string | undefined = newName.trim();
		if (name === '' || name === this.asset.definition.name)
			name = undefined;

		let description: string | undefined = newDescription.trim();
		if (description === '')
			description = undefined;

		return this.withProps({ name, description });
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
