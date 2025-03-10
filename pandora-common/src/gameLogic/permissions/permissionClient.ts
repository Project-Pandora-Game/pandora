import type { GameLogicCharacter } from '../character/character.ts';
import type { PermissionSetup, PermissionType } from './permissionData.ts';
import type { Immutable } from 'immer';
import { GameLogicPermission } from './permission.ts';

export class GameLogicPermissionClient extends GameLogicPermission {
	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>) {
		super(character, setup);
	}

	public override checkPermission(actingCharacter: GameLogicCharacter): PermissionType {
		if (actingCharacter.id === this.character.id)
			return 'yes';

		// Client knows nothing about permissions, so assume we can (server will correct us otherwise)
		return 'yes';
	}
}
