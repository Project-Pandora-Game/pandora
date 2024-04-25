import { EvalItemPath } from './appearanceHelpers';
import type { ActionTargetRoomInventory, ItemPath } from './appearanceTypes';
import type { AppearanceItems } from './appearanceValidation';
import type { AssetManager } from './assetManager';
import type { Item } from './item';
import type { AssetFrameworkRoomState } from './state/roomState';

export class RoomInventory implements ActionTargetRoomInventory {
	public readonly roomState: AssetFrameworkRoomState;

	public readonly type = 'roomInventory';
	public readonly allowReTargeting: boolean;

	protected get assetManager(): AssetManager {
		return this.roomState.assetManager;
	}

	private get _items(): AppearanceItems {
		return this.roomState.items;
	}

	constructor(roomState: AssetFrameworkRoomState, allowReTargeting: boolean = true) {
		this.roomState = roomState;
		this.allowReTargeting = allowReTargeting;
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	public getItem(path: ItemPath): Item | undefined {
		return EvalItemPath(this._items, path);
	}

	public withNoReTargeting(): RoomInventory {
		return this.allowReTargeting ? new RoomInventory(this.roomState, false) : this;
	}

	public getAllItems(): readonly Item[] {
		return this._items;
	}
}
