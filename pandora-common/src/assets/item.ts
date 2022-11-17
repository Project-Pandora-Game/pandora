import { z } from 'zod';
import { Logger } from '../logging';
import { HexColorString, HexColorStringSchema } from '../validation';
import { ItemId, ItemIdSchema } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IItemModule, IModuleItemDataCommonSchema } from './modules/common';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from './properties';

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: z.array(HexColorStringSchema).optional(),
	moduleData: z.record(IModuleItemDataCommonSchema).optional(),
});
export type ItemBundle = z.infer<typeof ItemBundleSchema>;

function FixupColorFromAsset(color: readonly HexColorString[], asset: Asset): readonly HexColorString[] {
	const colorization = asset.definition.colorization ?? [];
	// Trim if longer than wanted
	if (color.length > colorization.length) {
		color = color.slice(0, colorization.length);
	}
	// Add if missing
	if (color.length < colorization.length) {
		color = color.concat(colorization.map((c) => c.default).slice(color.length));
	}
	return color;
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
	public readonly color: readonly HexColorString[];
	public readonly modules: ReadonlyMap<string, IItemModule>;

	constructor(id: ItemId, asset: Asset, bundle: ItemBundle, context: IItemLoadContext) {
		this.assetMananger = context.assetMananger;
		this.id = id;
		this.asset = asset;
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
		// Load color from bundle
		this.color = FixupColorFromAsset(bundle.color ?? [], asset);
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
			color: this.color.length > 0 ? this.color.slice() : undefined,
			moduleData,
		};
	}

	public validate(isWorn: boolean): AppearanceValidationResult {
		// Check the asset can actually be worn
		if (isWorn && this.asset.definition.wearable === false)
			return false;

		for (const module of this.modules.values()) {
			if (!module.validate(isWorn))
				return false;
		}

		return true;
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: readonly HexColorString[]): Item {
		const bundle = this.exportToBundle();
		bundle.color = color.slice();
		return new Item(this.id, this.asset, bundle, {
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: false,
		});
	}

	public moduleAction(moduleName: string, action: ItemModuleAction): Item | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(action);
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
