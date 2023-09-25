import { CharacterId } from '../../character';
import { AssertNever } from '../../utility';
import { AppearanceCharacterManipulator, AppearanceRootManipulator } from '../appearanceHelpers';
import { ActionHandlerMessageWithTarget, RoomTargetSelector } from '../appearanceTypes';
import { AppearanceItems } from '../appearanceValidation';
import { AssetManager } from '../assetManager';
import { FilterItemWearable } from '../item';
import { AssetFrameworkCharacterState } from '../state/characterState';
import { AssetFrameworkGlobalState } from '../state/globalState';
import { AssetFrameworkRoomState } from '../state/roomState';

export class AssetFrameworkGlobalStateManipulator {
	public readonly assetManager: AssetManager;
	public currentState: AssetFrameworkGlobalState;

	private _messages: ActionHandlerMessageWithTarget[] = [];

	constructor(originState: AssetFrameworkGlobalState) {
		this.assetManager = originState.assetManager;
		this.currentState = originState;
	}

	public getManipulatorFor(target: RoomTargetSelector): AppearanceRootManipulator {
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

	public getItems(target: RoomTargetSelector): AppearanceItems {
		return this.currentState.getItems(target) ?? [];
	}

	public setItems(target: RoomTargetSelector, newItems: AppearanceItems): boolean {
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

	public queueMessage(message: ActionHandlerMessageWithTarget): void {
		this._messages.push(message);
	}

	public getAndClearPendingMessages(): ActionHandlerMessageWithTarget[] {
		const messages = this._messages;
		this._messages = [];
		return messages;
	}
}
