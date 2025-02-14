import { TypedEventEmitter } from '../../event';
import type { GameLogicCharacter } from '../character';
import { GameLogicPermission, GameLogicPermissionServer } from '../permissions';
import { GameLogicPermissionClient } from '../permissions/permissionClient';
import type { CharacterModifierTypeConfig } from './characterModifierData';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, CharacterModifierType } from './modifierTypes/_index';

export type GameLogicModifierTypeEvents = {
	configChanged: void;
};

export abstract class GameLogicModifierTypeData extends TypedEventEmitter<GameLogicModifierTypeEvents> {
	public abstract readonly permission: GameLogicPermission;

	constructor() {
		super();
	}
}

export class GameLogicModifierTypeClient extends GameLogicModifierTypeData {
	public override permission: GameLogicPermissionClient;

	constructor(character: GameLogicCharacter, type: CharacterModifierType) {
		super();
		const config = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

		this.permission = new GameLogicPermissionClient(character, {
			group: 'characterModifierType',
			id: type,
			displayName: `Interact with modifiers of type "${config.visibleName}"`,
			defaultConfig: config.permissionDefault,
			forbidDefaultAllowOthers: config.permissionForbidDefaultAllowOthers,
		});
	}
}

export class GameLogicModifierTypeServer extends GameLogicModifierTypeData {
	public override permission: GameLogicPermissionServer;

	constructor(character: GameLogicCharacter, type: CharacterModifierType, data: CharacterModifierTypeConfig | undefined) {
		super();
		const config = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

		this.permission = new GameLogicPermissionServer(character, {
			group: 'characterModifierType',
			id: type,
			displayName: `Interact with modifiers of type "${config.visibleName}"`,
			defaultConfig: config.permissionDefault,
			forbidDefaultAllowOthers: config.permissionForbidDefaultAllowOthers,
		}, data?.permission ?? null);

		this.permission.on('configChanged', () => {
			this.emit('configChanged', undefined);
		});
	}

	public getConfig(): CharacterModifierTypeConfig | undefined {
		const permission = this.permission.getConfig();

		// Return undefined if everything matches default
		if (permission == null)
			return undefined;

		return {
			permission,
		};
	}
}
