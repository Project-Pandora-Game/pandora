import { z } from 'zod';
import { zTemplateString } from '../validation';
import { Asset } from './asset';
import { AssetIdSchema } from './definitions';

export const ItemIdSchema = zTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

export const ItemBundleSchema = z.object({
	id: ItemIdSchema,
	asset: AssetIdSchema,
});
export type ItemBundle = z.infer<typeof ItemBundleSchema>;

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export class Item {
	readonly id: ItemId;
	readonly asset: Asset;

	constructor(id: ItemId, asset: Asset) {
		this.id = id;
		this.asset = asset;
	}

	public exportToBundle(): ItemBundle {
		return {
			id: this.id,
			asset: this.asset.id,
		};
	}

	public importFromBundle(bundle: ItemBundle) {
		if (this.asset.id !== bundle.asset) {
			throw new Error(`Attempt to import different asset bundle into item (${this.asset.id} vs ${bundle.asset})`);
		}
	}
}
