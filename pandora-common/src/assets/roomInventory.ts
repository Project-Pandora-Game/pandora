import { EvalItemPath } from './appearanceHelpers';
import type { ItemPath, ActionTargetRoomInventory } from './appearanceTypes';
import { AppearanceItems } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { Item } from './item';
import { AssetFrameworkRoomState } from './state/roomState';

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
