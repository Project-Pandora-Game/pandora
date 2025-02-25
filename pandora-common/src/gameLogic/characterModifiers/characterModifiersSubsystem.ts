import { TypedEventEmitter } from '../../event';
import { GameLogicPermission, IPermissionProvider } from '../permissions';
import { CharacterModifierType } from './modifierTypes/_index';

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
