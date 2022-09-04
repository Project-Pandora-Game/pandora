import { z } from 'zod';
import { HexColorString, HexColorStringSchema, zTemplateString } from '../validation';
import { Asset } from './asset';
import { AssetIdSchema } from './definitions';

export const ItemIdSchema = zTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
	color: z.array(HexColorStringSchema).optional(),
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

	constructor(id: ItemId, asset: Asset, bundle: ItemBundle) {
		this.id = id;
		this.asset = asset;
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
		// Load color from bundle
		this.color = FixupColorFromAsset(bundle.color ?? [], asset);
	}

	public exportToBundle(): ItemBundle {
		return {
			id: this.id,
			asset: this.asset.id,
			color: this.color.length > 0 ? this.color.slice() : undefined,
		};
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: readonly HexColorString[]): Item {
		const bundle = this.exportToBundle();
		bundle.color = color.slice();
		return new Item(this.id, this.asset, bundle);
	}
}
