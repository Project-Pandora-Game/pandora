import { z } from 'zod';
import { HexColorString, HexColorStringSchema, zTemplateString } from '../validation';
import { MergePoseLimits, PoseLimitsResult } from './appearanceValidation';
import { Asset } from './asset';
import { AssetIdSchema } from './definitions';
import { EffectsDefinition, EFFECTS_DEFAULT, MergeEffects } from './effects';
import { ItemModuleAction, LoadItemModule } from './modules';
import { IItemModule, IModuleItemDataCommonSchema } from './modules/common';

export const ItemIdSchema = zTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

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

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export class Item {
	readonly id: ItemId;
	readonly asset: Asset;
	readonly color: readonly HexColorString[];
	readonly modules: ReadonlyMap<string, IItemModule>;

	constructor(id: ItemId, asset: Asset, bundle: ItemBundle) {
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
			modules.set(moduleName, LoadItemModule(asset, moduleName, bundle.moduleData?.[moduleName]));
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

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: readonly HexColorString[]): Item {
		const bundle = this.exportToBundle();
		bundle.color = color.slice();
		return new Item(this.id, this.asset, bundle);
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
		});
	}

	public getEffects(): EffectsDefinition {
		const assetEffects = MergeEffects(EFFECTS_DEFAULT, this.asset.definition.effects);
		return Array.from(this.modules.values())
			.map((m) => m.getEffects())
			.reduce(MergeEffects, assetEffects);
	}

	public applyPoseLimits(base: PoseLimitsResult): PoseLimitsResult {
		return Array.from(this.modules.values())
			.reduce((b, m) => m.applyPoseLimits(b),
				MergePoseLimits(base, this.asset.definition.poseLimits));
	}
}
