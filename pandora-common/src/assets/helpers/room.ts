import { EvalItemPath } from '../appearanceHelpers';
import type { ActionTargetRoom, ItemPath } from '../appearanceTypes';
import type { AppearanceItems } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { Item } from '../item';
import type { AssetFrameworkRoomState } from '../state/roomState';

export class RoomActionTarget implements ActionTargetRoom {
	public readonly roomState: AssetFrameworkRoomState;

	public readonly type = 'room';

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
