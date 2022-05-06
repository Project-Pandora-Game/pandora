import { CreateStringValidator } from '../validation';
import { Asset } from './asset';
import { AssetId } from './definitions';

export type ItemId = `i/${string}`;

/** Test if a given value is a valid ItemId - `'i/{string}'` */
export const IsItemId = CreateStringValidator<ItemId>({
	regex: /^i\//,
});

export interface ItemBundle {
	id: ItemId;
	asset: AssetId;
}

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
