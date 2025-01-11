import { AssertNotNullable } from '../../utility/misc';
import { ArrayIncludesGuard } from '../../validation';
import type { GameLogicCharacterClient } from '../character/characterClient';
import { IPermissionProvider } from '../permissions';
import { GameLogicPermissionClient } from '../permissions/permissionClient';
import { CharacterModifiersSubsystem } from './characterModifiersSubsystem';
import { GameLogicModifierTypeClient } from './characterModifierType';
import { CHARACTER_MODIFIER_TYPES, type CharacterModifierType } from './modifierTypes/_index';

export class CharacterModifiersSubsystemClient extends CharacterModifiersSubsystem implements IPermissionProvider<GameLogicPermissionClient> {
	private readonly modifierTypes: ReadonlyMap<CharacterModifierType, GameLogicModifierTypeClient>;

	constructor(character: GameLogicCharacterClient) {
		super();
		// Load modifier types
		const modifierTypes = new Map<CharacterModifierType, GameLogicModifierTypeClient>();
		for (const type of CHARACTER_MODIFIER_TYPES) {
			modifierTypes.set(type, new GameLogicModifierTypeClient(character, type));
		}
		this.modifierTypes = modifierTypes;
	}

	public override getModifierTypePermission(type: CharacterModifierType): GameLogicPermissionClient {
		const modifierType = this.modifierTypes.get(type);
		AssertNotNullable(modifierType);

		return modifierType.permission;
	}

	public override getPermission(permissionId: string): GameLogicPermissionClient | null {
		if (!ArrayIncludesGuard(CHARACTER_MODIFIER_TYPES, permissionId)) {
			return null;
		}

		return this.getModifierTypePermission(permissionId);
	}
}
