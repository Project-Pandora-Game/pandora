import _ from 'lodash';
import type { AppearanceActionHandlerMessageTemplate, ItemContainerPath, ItemId, ItemPath } from './appearanceTypes';
import type { AssetManager } from './assetManager';
import type { Item } from './item';
import type { IItemModule } from './modules/common';
import { AppearanceItems, AppearanceItemsFixBodypartOrder } from './appearanceValidation';
import { Assert } from '../utility';

export function SplitContainerPath(path: ItemContainerPath): {
	itemPath: ItemPath;
	module: string;
} | undefined {
	if (path.length < 1)
		return undefined;

	return {
		itemPath: {
			container: path.slice(0, -1),
			itemId: path[path.length - 1].item,
		},
		module: path[path.length - 1].module,
	};
}

export type IContainerPathActual = readonly {
	readonly item: Item;
	readonly moduleName: string;
	readonly module: IItemModule;
}[];

export abstract class AppearanceManipulator {
	public abstract getItems(): AppearanceItems;
	protected abstract _applyItems(items: AppearanceItems): boolean;

	public abstract readonly isCharacter: boolean;
	public abstract readonly container: IItemModule | null;
	public abstract readonly containerPath: IContainerPathActual | null;

	public readonly assetMananger: AssetManager;

	constructor(assetManager: AssetManager) {
		this.assetMananger = assetManager;
	}

	public getContainer(path: ItemContainerPath): AppearanceManipulator {
		if (path.length < 1)
			return this;
		const step = path[0];
		return new AppearanceContainerManipulator(this, step.item, step.module).getContainer(path.slice(1));
	}

	public addItem(item: Item, index?: number): boolean {
		if (item.asset.definition.bodypart != null && !this.isCharacter)
			return false;

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
		if (this.isCharacter) {
			items = AppearanceItemsFixBodypartOrder(this.assetMananger, items);
		}
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

	public abstract queueMessage(message: AppearanceActionHandlerMessageTemplate): void;
}

class AppearanceContainerManipulator extends AppearanceManipulator {
	private _base: AppearanceManipulator;
	private _item: ItemId;
	private _module: string;

	public readonly isCharacter: boolean = false;
	public get container(): IItemModule | null {
		const item = this._base.getItems().find((i) => i.id === this._item);
		return item?.modules.get(this._module) ?? null;
	}
	public get containerPath(): IContainerPathActual | null {
		const basePath = this._base.containerPath;
		const item = this._base.getItems().find((i) => i.id === this._item);
		const module = item?.modules.get(this._module);
		return (!basePath || !item || !module) ? null : [
			...basePath,
			{ item, moduleName: this._module, module },
		];
	}

	constructor(base: AppearanceManipulator, item: ItemId, module: string) {
		super(base.assetMananger);
		this._base = base;
		this._item = item;
		this._module = module;
	}

	public getItems(): AppearanceItems {
		const item = this._base.getItems().find((i) => i.id === this._item);
		return item ? item.getModuleItems(this._module) : [];
	}

	protected _applyItems(items: AppearanceItems): boolean {
		return this._base.modifyItem(this._item, (it) => it.setModuleItems(this._module, items));
	}

	public queueMessage(message: AppearanceActionHandlerMessageTemplate): void {
		message.itemContainerPath ??= this.containerPath?.map((i) => ({ assetId: i.item.asset.id, module: i.moduleName }));
		this._base.queueMessage(message);
	}
}

export class AppearanceRootManipulator extends AppearanceManipulator {
	private _items: AppearanceItems;
	private _messages: AppearanceActionHandlerMessageTemplate[] = [];

	public readonly isCharacter: boolean;
	public readonly container: null = null;
	public readonly containerPath: IContainerPathActual = [];

	constructor(assetMananger: AssetManager, items: AppearanceItems, isCharacter: boolean) {
		super(assetMananger);
		this._items = items.slice();
		this.isCharacter = isCharacter;
	}

	/** Gets items, but is only present on the root of appearance to prevent accidental passing of container manipultors */
	public getRootItems(): AppearanceItems {
		return this.getItems();
	}

	/** Replaces all items, compeltely discarding current ones */
	public resetItemsTo(newItems: AppearanceItems): void {
		const r = this._applyItems(newItems);
		Assert(r);
	}

	public getItems(): AppearanceItems {
		return this._items;
	}

	protected _applyItems(items: AppearanceItems): boolean {
		this._items = items;
		return true;
	}

	public queueMessage(message: AppearanceActionHandlerMessageTemplate): void {
		message.itemContainerPath ??= this.containerPath?.map((i) => ({ assetId: i.item.asset.id, module: i.moduleName }));
		this._messages.push(message);
	}

	public getAndClearPendingMessages(): AppearanceActionHandlerMessageTemplate[] {
		const messages = this._messages;
		this._messages = [];
		return messages;
	}
}
