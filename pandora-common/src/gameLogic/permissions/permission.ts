import { Immutable } from 'immer';
import { TypedEventEmitter } from '../../event';
import { GameLogicCharacter } from '../character/character';
import { PermissionConfig, PermissionConfigDefault, PermissionGroup, PermissionSetup } from './permissionData';

export type GameLogicPermissionEvents = {
	configChanged: void;
};

export abstract class GameLogicPermission extends TypedEventEmitter<GameLogicPermissionEvents> {
	public readonly setup: Immutable<PermissionSetup>;

	public get group(): PermissionGroup {
		return this.setup.group;
	}
	public get id(): string {
		return this.setup.id;
	}
	public get displayName(): string {
		return this.setup.displayName;
	}
	public get defaultConfig(): Immutable<PermissionConfigDefault> {
		return this.setup.defaultConfig;
	}

	public readonly character: GameLogicCharacter;

	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>) {
		super();
		this.setup = Object.freeze(setup);
		this.character = character;
	}

	public abstract checkPermission(actingCharacter: GameLogicCharacter): boolean;
}

export function MakePermissionConfigFromDefault(defaultConfig: PermissionConfigDefault): PermissionConfig {
	return {
		allowOthers: defaultConfig.allowOthers,
	};
}

export interface IPermissionProvider<PermissionClass extends GameLogicPermission = GameLogicPermission> {
	getPermission(permissionId: string): PermissionClass | null;
}
