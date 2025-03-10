import { EvalItemPath } from './appearanceHelpers.ts';
import type { ActionTargetRoomInventory, ItemPath } from './appearanceTypes.ts';
import type { AppearanceItems } from './appearanceValidation.ts';
import type { AssetManager } from './assetManager.ts';
import type { Item } from './item/index.ts';
import type { AssetFrameworkRoomState } from './state/roomState.ts';

export class RoomInventory implements ActionTargetRoomInventory {
	public readonly roomState: AssetFrameworkRoomState;

	public readonly type = 'roomInventory';

	protected get assetManager(): AssetManager {
		return this.roomState.assetManager;
	}

	private get _items(): AppearanceItems {
		return this.roomState.items;
	}

	constructor(roomState: AssetFrameworkRoomState) {
		this.roomState = roomState;
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
