import type { ItemPath, RoomActionTargetRoomInventory } from './appearanceTypes';
import { AppearanceItems } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { Item } from './item';
import { AssetFrameworkGlobalStateContainer } from './state/globalState';
import { AssetFrameworkRoomState, RoomInventoryBundle } from './state/roomState';
import { Assert } from '../utility';

export const ROOM_INVENTORY_BUNDLE_DEFAULT: RoomInventoryBundle = {
	items: [],
};

export class RoomInventory implements RoomActionTargetRoomInventory {
	public readonly globalStateContainer: AssetFrameworkGlobalStateContainer;

	public readonly type = 'roomInventory';

	protected get assetManager(): AssetManager {
		return this.globalStateContainer.assetManager;
	}

	private get _state(): AssetFrameworkRoomState {
		const state = this.globalStateContainer.currentState.room;
		Assert(state != null, 'Attempting to edit room inventory when not in room');
		return state;
	}

	private get _items(): AppearanceItems {
		return this._state.items;
	}

	constructor(globalStateContainer: AssetFrameworkGlobalStateContainer) {
		this.globalStateContainer = globalStateContainer;
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	public getItem({ container, itemId }: ItemPath): Item | undefined {
		let current = this._items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}

	public getAllItems(): readonly Item[] {
		return this._items;
	}
}
