import _ from 'lodash';
import { z } from 'zod';
import { Logger } from '../logging';
import type { Writeable } from '../utility';
import { HexColorString, HexColorStringSchema } from '../validation';
import { ActionMessageTemplateHandler, ItemId, ItemIdSchema } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IItemModule, IModuleItemDataCommonSchema } from './modules/common';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from './properties';

export const ItemColorBundleSchema = z.record(z.string(), HexColorStringSchema);
export type ItemColorBundle = Readonly<z.infer<typeof ItemColorBundleSchema>>;

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: ItemColorBundleSchema.or(z.array(HexColorStringSchema)).optional(),
	moduleData: z.record(IModuleItemDataCommonSchema).optional()
});
export type ItemBundle = z.infer<typeof ItemBundleSchema>;

function FixupColorFromAsset(asset: Asset, color: ItemColorBundle | HexColorString[] = {}): ItemColorBundle {
	const colorization = asset.definition.colorization ?? {};
	if (Array.isArray(color)) {
		const keys = Object.keys(colorization);
		const init: Writeable<ItemColorBundle> = {};
		color = color.reduce((acc, value, index) => {
			if (keys.length < index)
				acc[keys[index]] = value;

			return acc;
		}, init);
	}
	const result: Writeable<ItemColorBundle> = {};
	for (const [key, value] of Object.entries(colorization)) {
		if (color[key] !== undefined) {
			result[key] = color[key];
		} else {
			result[key] = value.default;
		}
	}
	return result;
}

export type IItemLoadContext = {
	assetMananger: AssetManager;
	doLoadTimeCleanup: boolean;
	logger?: Logger;
};

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export class Item {
	public readonly assetMananger: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset;
	public readonly color: ItemColorBundle;
	public readonly modules: ReadonlyMap<string, IItemModule>;

	constructor(id: ItemId, asset: Asset, bundle: ItemBundle, context: IItemLoadContext) {
		this.assetMananger = context.assetMananger;
		this.id = id;
		this.asset = asset;
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
		// Load color from bundle
		this.color = FixupColorFromAsset(asset, bundle.color);
		// Load modules
		const modules = new Map<string, IItemModule>();
		for (const moduleName of Object.keys(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule(asset, moduleName, bundle.moduleData?.[moduleName], context));
		}
		this.modules = modules;
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

	private exportColorToBundle(): ItemColorBundle | undefined {
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
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: false,
		});
	}

	public moduleAction(moduleName: string, action: ItemModuleAction, messageHandler: ActionMessageTemplateHandler): Item | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(action, messageHandler);
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
			assetMananger: this.assetMananger,
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
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: false,
		});
	}

	public getPropertiesParts(): AssetProperties[] {
		const propertyParts: AssetProperties[] = [this.asset.definition];
		propertyParts.push(...Array.from(this.modules.values()).map((m) => m.getProperties()));

		return propertyParts;
	}

	public getProperties(): AssetPropertiesIndividualResult {
		return this.getPropertiesParts()
			.reduce(MergeAssetPropertiesIndividual, CreateAssetPropertiesIndividualResult());
	}
}
