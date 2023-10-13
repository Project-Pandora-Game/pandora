import { GameLogicCharacter } from '../character/character';
import { PermissionSetup } from './permissionData';
import { Immutable } from 'immer';
import { GameLogicPermission } from './permission';

export class GameLogicPermissionClient extends GameLogicPermission {
	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>) {
		super(character, setup);
	}

	public override checkPermission(actingCharacter: GameLogicCharacter): boolean {
		if (actingCharacter.id === this.character.id)
			return true;

		// Client knows nothing about permissions, so assume we can (server will correct us otherwise)
		return true;
	}
}
