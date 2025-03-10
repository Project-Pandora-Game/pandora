import type { Immutable } from 'immer';
import { TypedEventEmitter } from '../../event.ts';
import type { GameLogicCharacter } from '../character/character.ts';
import { PERMISSION_MAX_CHARACTER_OVERRIDES, PermissionConfig, PermissionConfigDefault, PermissionGroup, PermissionSetup, PermissionType, PermissionTypeInvalid } from './permissionData.ts';
import type { PermissionRestriction } from '../../character/restrictionTypes.ts';

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
	public get forbidDefaultAllowOthers(): readonly PermissionType[] | undefined {
		return this.setup.forbidDefaultAllowOthers;
	}
	public get maxCharacterOverrides(): number {
		return this.setup.maxCharacterOverrides ?? PERMISSION_MAX_CHARACTER_OVERRIDES;
	}

	public readonly character: GameLogicCharacter;

	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>) {
		super();
		this.setup = Object.freeze(setup);
		this.character = character;
	}

	public getRestrictionDescriptor(permissionResult: PermissionTypeInvalid): PermissionRestriction {
		return {
			type: 'missingPermission',
			target: this.character.id,
			permissionGroup: this.group,
			permissionId: this.id,
			permissionDescription: this.displayName,
			permissionResult,
		};
	}

	public abstract checkPermission(actingCharacter: GameLogicCharacter): PermissionType;
}

export function MakePermissionConfigFromDefault(defaultConfig: PermissionConfigDefault): PermissionConfig {
	return {
		allowOthers: defaultConfig.allowOthers,
		characterOverrides: {},
	};
}

export interface IPermissionProvider<PermissionClass extends GameLogicPermission = GameLogicPermission> {
	getPermission(permissionId: string): PermissionClass | null;
}
