import { Immutable } from 'immer';
import _ from 'lodash';
import { z } from 'zod';
import { Logger } from '../logging';
import { MemoizeNoArg, Writeable } from '../utility';
import { HexColorString, HexColorStringSchema } from '../validation';
import type { AppearanceActionContext } from './appearanceActions';
import { ActionMessageTemplateHandler, ItemId, ItemIdSchema } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetColorization, AssetIdSchema } from './definitions';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IItemModule } from './modules/common';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from './properties';

export const ItemColorBundleSchema = z.record(z.string(), HexColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: ItemColorBundleSchema.or(z.array(HexColorStringSchema)).optional(),
	moduleData: z.record(z.unknown()).optional(),
});
export type ItemBundle = z.infer<typeof ItemBundleSchema>;

export type IItemLoadContext = {
	assetManager: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
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
	private readonly color: ItemColorBundle;
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

	public overrideColors(items: AppearanceItems): Item {
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return this;

		const { disableColorization } = this.getProperties();
		if (disableColorization.size === 0)
			return this;

		let hasGroup = false;
		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			result[key] = value;

			if (def.group == null || !disableColorization.has(def.group))
				continue;

			const groupColor = this._resolveColorGroup(items, def);
			if (groupColor == null)
				continue;

			hasGroup = true;
		}

		return hasGroup ? this.changeColor(result) : this;
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
	public getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = [this.asset.definition];
		propertyParts.push(...Array.from(this.modules.values()).map((m) => m.getProperties()));

		return propertyParts;
	}

	@MemoizeNoArg
	public getProperties(): AssetPropertiesIndividualResult {
		return this.getPropertiesParts()
			.reduce(MergeAssetPropertiesIndividual, CreateAssetPropertiesIndividualResult());
	}

	public resolveColor(items: AppearanceItems, colorizationKey?: string): HexColorString | undefined {
		if (colorizationKey == null || !this.asset.definition.colorization)
			return undefined;

		const colorization = this.asset.definition.colorization[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return this._resolveColorGroup(items, colorization) ?? colorization.default;
	}

	private _resolveColorGroup(items: AppearanceItems, { group }: AssetColorization): HexColorString | undefined {
		if (!group)
			return undefined;

		let color: HexColorString | undefined;
		let colorSecondary: HexColorString | undefined;
		let foundSelf = false;
		for (const item of items) {
			if (item.id === this.id) {
				if (color)
					return color;

				foundSelf = true;
				continue;
			}

			const { primary, secondary } = item._getColorByGroup(group);
			if (primary) {
				if (foundSelf)
					return primary;

				color = primary;
			}
			if (secondary && (!colorSecondary || !foundSelf)) {
				colorSecondary = secondary;
			}
		}
		return color ?? colorSecondary;
	}

	private _getColorByGroup(group: string): { primary?: HexColorString; secondary?: HexColorString; } {
		const { disableColorization } = this.getProperties();
		const resultKey = disableColorization.has(group) ? 'secondary' : 'primary' as const;
		for (const [key, value] of Object.entries(this.asset.definition.colorization ?? {})) {
			if (value.group !== group || !this.color[key])
				continue;

			return { [resultKey]: this.color[key] };
		}
		return {};
	}

	private _loadColor(color: ItemColorBundle | HexColorString[] = {}): ItemColorBundle {
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

			result[key] = color[key] ?? value.default;
		}
		return result;
	}
}
