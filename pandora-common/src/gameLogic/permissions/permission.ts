import { Immutable } from 'immer';
import { TypedEventEmitter } from '../../event';
import { GameLogicCharacter } from '../character/character';
import { PermissionConfig, PermissionConfigDefault, PermissionGroup, PermissionSetup } from './permissionData';

export type GameLogicPermissionEvents = {
	configChanged: void;
};

export abstract class GameLogicPermission extends TypedEventEmitter<GameLogicPermissionEvents> {
	public readonly group: PermissionGroup;
	public readonly id: string;
	public readonly displayName: string;
	public readonly defaultConfig: Immutable<PermissionConfigDefault>;

	public readonly character: GameLogicCharacter;

	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>) {
		super();
		this.group = setup.group;
		this.id = setup.id;
		this.displayName = setup.displayName;
		this.defaultConfig = setup.defaultConfig;
		this.character = character;
	}

	public abstract checkPermission(actingCharacter: GameLogicCharacter): boolean;
}

export function MakePermissionConfigFromDefault(defaultConfig: PermissionConfigDefault): PermissionConfig {
	return {
		allowOthers: defaultConfig.allowOthers,
	};
}

export interface IPermissionProvider {
	getPermission(permissionId: string): GameLogicPermission | null;
}
