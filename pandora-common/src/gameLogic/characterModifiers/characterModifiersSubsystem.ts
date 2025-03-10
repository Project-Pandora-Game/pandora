import { TypedEventEmitter } from '../../event.ts';
import { GameLogicPermission, IPermissionProvider } from '../permissions/index.ts';
import { CharacterModifierType } from './modifierTypes/_index.ts';

export type CharacterModifiersSubsystemEvents = {
	dataChanged: void;
	modifiersChanged: void;
};

export abstract class CharacterModifiersSubsystem extends TypedEventEmitter<CharacterModifiersSubsystemEvents> implements IPermissionProvider {

	constructor() {
		super();
	}

	public abstract getModifierTypePermission(type: CharacterModifierType): GameLogicPermission;
	public abstract getPermission(permissionId: string): GameLogicPermission | null;
}
