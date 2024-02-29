import { EvalItemPath } from '../appearanceHelpers';
import type { ActionTargetSpaceInventory, ItemPath } from '../appearanceTypes';
import type { AppearanceItems } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { Item } from '../item';
import type { AssetFrameworkSpaceInventoryState } from '../state/spaceInventoryState';

export class SpaceInventory implements ActionTargetSpaceInventory {
	public readonly inventoryState: AssetFrameworkSpaceInventoryState;

	public readonly type = 'spaceInventory';

	protected get assetManager(): AssetManager {
		return this.inventoryState.assetManager;
	}

	private get _items(): AppearanceItems {
		return this.inventoryState.items;
	}

	constructor(inventoryState: AssetFrameworkSpaceInventoryState) {
		this.inventoryState = inventoryState;
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	public getItem(path: ItemPath): Item | undefined {
		return EvalItemPath(this._items, path);
	}

	public getAllItems(): readonly Item[] {
		return this._items;
	}
}
