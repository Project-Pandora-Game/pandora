import _ from 'lodash';
import { AppearanceItems, AppearanceItemsFixBodypartOrder } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { Item, ItemId } from './item';

export abstract class AppearanceManipulator {
	public abstract getItems(): AppearanceItems;
	protected abstract _applyItems(items: AppearanceItems): boolean;

	public readonly assetMananger: AssetManager;

	constructor(assetManager: AssetManager) {
		this.assetMananger = assetManager;
	}

	public addItem(item: Item, index?: number): boolean {
		let items = this.getItems().slice();
		if (items.some((it) => it.id === item.id))
			return false;
		if (index != null) {
			if (!Number.isInteger(index) || index < 0 || index > items.length)
				return false;
			items.splice(index, 0, item);
		} else {
			items.push(item);
		}
		items = AppearanceItemsFixBodypartOrder(this.assetMananger, items);
		return this._applyItems(items);
	}

	public removeMatchingItems(predicate: (item: Item) => boolean): AppearanceItems {
		const items = this.getItems().slice();
		const result = _.remove(items, (item) => predicate(item));
		return this._applyItems(items) ? result : [];
	}

	public moveItem(id: ItemId, shift: number): boolean {
		const items = this.getItems().slice();
		const currentPos = items.findIndex((item) => item.id === id);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= items.length)
			return false;

		const moved = items.splice(currentPos, 1);
		items.splice(newPos, 0, ...moved);
		return this._applyItems(items);
	}

	public modifyItem(id: ItemId, mutator: (item: Item) => (Item | null)): boolean {
		const items = this.getItems().slice();
		const index = items.findIndex((i) => i.id === id);
		if (index < 0)
			return false;
		const result = mutator(items[index]);
		if (!result || result.id !== id || result.asset !== result.asset)
			return false;
		items[index] = result;
		return this._applyItems(items);
	}
}

export class AppearanceRootManipulator extends AppearanceManipulator {
	private _items: AppearanceItems;

	constructor(assetMananger: AssetManager, items: AppearanceItems) {
		super(assetMananger);
		this._items = items.slice();
	}

	getItems(): AppearanceItems {
		return this._items;
	}

	_applyItems(items: AppearanceItems): boolean {
		this._items = items;
		return true;
	}
}
