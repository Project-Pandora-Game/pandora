import { CharacterId } from '../../character';
import { AssertNever } from '../../utility';
import { AppearanceCharacterManipulator, AppearanceRootManipulator } from '../appearanceHelpers';
import { ActionTargetSelector } from '../appearanceTypes';
import { AppearanceItems } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { FilterItemWearable } from '../item';
import type { AssetFrameworkCharacterState } from '../state/characterState';
import type { AssetFrameworkGlobalState } from '../state/globalState';
import type { AssetFrameworkRoomState } from '../state/roomState';

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
		} else if (target.type === 'roomInventory') {
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

	public produceRoomState(producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): boolean {
		const newState = this.currentState.produceRoomState(producer);

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
		} else if (target.type === 'roomInventory') {
			return this.produceRoomState(
				(room) => room.produceWithItems(newItems),
			);
		}
		AssertNever(target);
	}
}
