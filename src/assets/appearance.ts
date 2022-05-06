import { Logger } from '../logging';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { Item, ItemBundle, ItemId } from './item';

export interface AppearanceBundle {
	items: ItemBundle[];
}

export const APPEARANCE_BUNDLE_DEFAULT: AppearanceBundle = {
	items: [],
};

export class Appearance {
	items: Item[] = [];
	private assetMananger: AssetManager;
	public onChangeHandler: (() => void) | undefined;

	constructor(assetMananger: AssetManager, onChange?: () => void) {
		this.assetMananger = assetMananger;
		this.onChangeHandler = onChange;
	}

	protected makeItem(id: ItemId, asset: Asset): Item {
		return new Item(id, asset);
	}

	public exportToBundle(): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle()),
		};
	}

	public importFromBundle(bundle: AppearanceBundle, logger?: Logger): void {
		this.items = [];
		for (const itemBundle of bundle.items) {
			const asset = this.assetMananger.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = this.makeItem(itemBundle.id, asset);
			this.items.push(item);
			item.importFromBundle(itemBundle);
		}
		this.onChange();
	}

	public reloadAssetManager(assetManager: AssetManager, logger?: Logger) {
		const bundle = this.exportToBundle();
		this.assetMananger = assetManager;
		this.importFromBundle(bundle, logger);
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	public getItemById(id: ItemId): Item | undefined {
		return this.items.find((i) => i.id === id);
	}

	public listItemsByAsset(asset: AssetId) {
		return this.items.filter((i) => i.asset.id === asset);
	}

	public allowCreateItem(id: ItemId, asset: Asset): boolean {
		// Race condition prevention
		if (this.getItemById(id))
			return false;
		// Each item can only be added once
		if (this.listItemsByAsset(asset.id).length > 0)
			return false;
		return true;
	}

	public createItem(id: ItemId, asset: Asset): Item {
		if (!this.allowCreateItem(id, asset)) {
			throw new Error('Attempt to create item while not allowed');
		}
		const item = this.makeItem(id, asset);
		this.items.push(item);
		this.onChange();
		return item;
	}

	public allowRemoveItem(id: ItemId): boolean {
		const item = this.getItemById(id);
		if (!item)
			return false;
		return true;
	}

	public removeItem(id: ItemId): void {
		if (!this.allowRemoveItem(id)) {
			throw new Error('Attempt to remove item while not allowed');
		}
		const index = this.items.findIndex((i) => i.id === id);
		if (index < 0) {
			throw new Error('Item can be removed, but not found');
		}
		this.items.splice(index, 1);
		this.onChange();
	}
}
