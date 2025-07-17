import type { CharacterId } from '../../character/index.ts';
import { AssertNever } from '../../utility/misc.ts';
import { AppearanceCharacterManipulator, AppearanceRootManipulator } from '../appearanceHelpers.ts';
import { ActionTargetSelector, type RoomId } from '../appearanceTypes.ts';
import type { AssetManager } from '../assetManager.ts';
import { FilterItemWearable, type AppearanceItems } from '../item/index.ts';
import type { AssetFrameworkCharacterState } from '../state/characterState.ts';
import type { AssetFrameworkGlobalState } from '../state/globalState.ts';
import type { AssetFrameworkRoomState } from '../state/roomState.ts';

export class AssetFrameworkGlobalStateManipulator {
	public readonly assetManager: AssetManager;
	public currentState: AssetFrameworkGlobalState;

	constructor(originState: AssetFrameworkGlobalState) {
		this.assetManager = originState.assetManager;
		this.currentState = originState;
	}

	public getManipulatorFor(target: ActionTargetSelector): AppearanceRootManipulator {
		if (target.type === 'character') {
			return new AppearanceCharacterManipulator(this, target);
		} else if (target.type === 'room') {
			return new AppearanceRootManipulator(this, target);
		}
		AssertNever(target);
	}

	public produceCharacterState(characterId: CharacterId, producer: (currentState: AssetFrameworkCharacterState) => AssetFrameworkCharacterState | null): boolean {
		const newState = this.currentState.produceCharacterState(
			characterId,
			producer,
		);

		if (!newState)
			return false;

		this.currentState = newState;
		return true;
	}

	public produceMapCharacters(producer: (character: AssetFrameworkCharacterState) => AssetFrameworkCharacterState | null): boolean {
		for (const id of Array.from(this.currentState.characters.keys())) {
			if (!this.produceCharacterState(id, producer))
				return false;
		}

		return true;
	}

	public produceRoomState(roomId: RoomId, producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): boolean {
		const newState = this.currentState.produceSpaceState((s) => s.produceRoom(roomId, producer));

		if (!newState)
			return false;

		this.currentState = newState;
		return true;
	}

	public getItems(target: ActionTargetSelector): AppearanceItems {
		return this.currentState.getItems(target) ?? [];
	}

	public setItems(target: ActionTargetSelector, newItems: AppearanceItems): boolean {
		if (target.type === 'character') {
			// Check only wearable items are being applied
			const wearableItems = newItems.filter(FilterItemWearable);
			if (wearableItems.length !== newItems.length)
				return false;

			return this.produceCharacterState(
				target.characterId,
				(character) => character.produceWithItems(wearableItems),
			);
		} else if (target.type === 'room') {
			return this.produceRoomState(
				target.roomId,
				(room) => room.produceWithItems(newItems),
			);
		}
		AssertNever(target);
	}
}
