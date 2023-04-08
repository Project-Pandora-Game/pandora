import { Immutable } from 'immer';
import _ from 'lodash';
import { z } from 'zod';
import { Logger } from '../logging';
import { MemoizeNoArg, Writeable } from '../utility';
import { HexFullColorString, HexFullColorStringSchema } from '../validation';
import type { AppearanceActionContext } from './appearanceActions';
import { ActionMessageTemplateHandler, ItemId, ItemIdSchema } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetColorization, AssetIdSchema } from './definitions';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IItemModule } from './modules/common';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from './properties';

export const ItemColorBundleSchema = z.record(z.string(), HexFullColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: ItemColorBundleSchema.or(z.array(HexFullColorStringSchema)).optional(),
	moduleData: z.record(z.unknown()).optional(),
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
	color: HexFullColorString;
};

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export class Item {
	public readonly assetManager: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset;
	public readonly color: Immutable<ItemColorBundle>;
	public readonly modules: ReadonlyMap<string, IItemModule>;

	constructor(id: ItemId, asset: Asset, bundle: ItemBundle, context: IItemLoadContext) {
		this.assetManager = context.assetManager;
		this.id = id;
		this.asset = asset;
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
		// Load modules
		const modules = new Map<string, IItemModule>();
		for (const moduleName of Object.keys(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule(asset, moduleName, bundle.moduleData?.[moduleName], context));
		}
		this.modules = modules;
		// Load color from bundle
		this.color = this._loadColor(bundle.color);
	}

	public exportToBundle(): ItemBundle {
		let moduleData: ItemBundle['moduleData'];
		if (this.modules.size > 0) {
			moduleData = {};
			for (const [name, module] of this.modules.entries()) {
				moduleData[name] = module.exportData();
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

	public containerChanged(items: AppearanceItems, isCharacter: boolean): Item {
		if (!isCharacter)
			return this;

		return this._overrideColors(items);
	}

	public getColorOverrides(items: AppearanceItems): null | Record<string, ColorGroupResult> {
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

	public validate(isWorn: boolean): AppearanceValidationResult {
		// Check the asset can actually be worn
		if (isWorn && this.asset.definition.wearable === false)
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		// Check bodyparts are worn
		if (!isWorn && this.asset.definition.bodypart != null)
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
				},
			};

		for (const module of this.modules.values()) {
			const r = module.validate(isWorn);
			if (!r.success)
				return r;
		}

		return { success: true };
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: ItemColorBundle): Item {
		const bundle = this.exportToBundle();
		bundle.color = _.cloneDeep(color);
		return new Item(this.id, this.asset, bundle, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public moduleAction(context: AppearanceActionContext, moduleName: string, action: ItemModuleAction, messageHandler: ActionMessageTemplateHandler): Item | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action, messageHandler);
		if (!moduleResult)
			return null;
		const bundle = this.exportToBundle();
		return new Item(this.id, this.asset, {
			...bundle,
			moduleData: {
				...bundle.moduleData,
				[moduleName]: moduleResult.exportData(),
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
		const bundle = this.exportToBundle();
		return new Item(this.id, this.asset, {
			...bundle,
			moduleData: {
				...bundle.moduleData,
				[moduleName]: moduleResult.exportData(),
			},
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	@MemoizeNoArg
	public getPropertiesParts(): Immutable<AssetProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = [this.asset.definition];
		propertyParts.push(...Array.from(this.modules.values()).map((m) => m.getProperties()));

		return propertyParts;
	}

	@MemoizeNoArg
	public getProperties(): AssetPropertiesIndividualResult {
		return this.getPropertiesParts()
			.reduce(MergeAssetPropertiesIndividual, CreateAssetPropertiesIndividualResult());
	}

	public resolveColor(items: AppearanceItems, colorizationKey: string): HexFullColorString | undefined {
		const colorization = this.asset.definition.colorization?.[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return this._resolveColorGroup(items, colorizationKey, colorization)?.color ?? colorization.default;
	}

	private _overrideColors(items: AppearanceItems): Item {
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

			result[key] = LimitColorAlpha(overrides[key]?.color, def.minAlpha) ?? value;
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
	private _resolveColorGroup(items: AppearanceItems, ignoreKey: string, { group }: Immutable<AssetColorization>): ColorGroupResult | undefined {
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

	private _getColorByGroup(group: string, ignoreKey?: string): null | ['primary' | 'inherited', Immutable<AssetColorization>, HexFullColorString] {
		const { overrideColorKey, excludeFromColorInheritance } = this.getProperties();
		let inherited: [Immutable<AssetColorization>, HexFullColorString] | undefined;
		for (const [key, value] of Object.entries(this.asset.definition.colorization ?? {})) {
			if (value.group !== group || !this.color[key])
				continue;
			if (key === ignoreKey || excludeFromColorInheritance.has(key))
				continue;

			if (!overrideColorKey.has(key))
				return ['primary', value, this.color[key]];

			if (!inherited)
				inherited = [value, this.color[key]];
		}
		return inherited ? ['inherited', ...inherited] : null;
	}

	private _loadColor(color: ItemColorBundle | HexFullColorString[] = {}): ItemColorBundle {
		const colorization = this.asset.definition.colorization ?? {};
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

function LimitColorAlpha(color: HexFullColorString, minAlpha: number = 255): HexFullColorString {
	if (color.length === 7)
		return color;

	if (minAlpha === 255)
		return color.substring(0, 7) as HexFullColorString;

	const alpha = Math.min(parseInt(color.substring(7), 16), minAlpha);
	return color.substring(0, 7) + alpha.toString(16).padStart(2, '0') as HexFullColorString;
}
