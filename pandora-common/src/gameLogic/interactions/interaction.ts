import { Immutable } from 'immer';
import { TypedEventEmitter } from '../../event';
import type { GameLogicCharacter } from '../character';
import { GameLogicPermission, GameLogicPermissionServer } from '../permissions';
import { GameLogicPermissionClient } from '../permissions/permissionClient';
import { IInteractionConfig, INTERACTION_CONFIG, InteractionId } from './_interactionConfig';
import { InteractionData } from './interactionData';

export type GameLogicInteractionEvents = {
	configChanged: void;
};

export abstract class GameLogicInteraction extends TypedEventEmitter<GameLogicInteractionEvents> {
	public abstract readonly permission: GameLogicPermission;

	constructor() {
		super();
	}
}

export class GameLogicInteractionClient extends GameLogicInteraction {
	public override permission: GameLogicPermissionClient;

	constructor(character: GameLogicCharacter, id: InteractionId) {
		super();
		const config: Immutable<IInteractionConfig> = INTERACTION_CONFIG[id];

		this.permission = new GameLogicPermissionClient(character, {
			group: 'interaction',
			id,
			displayName: config.visibleName,
			icon: config.icon,
			defaultConfig: config.defaultPermissions,
			forbidDefaultAllowOthers: config.forbidDefaultAllowOthers,
			maxCharacterOverrides: config.maxCharacterOverrides,
		});
	}
}

export class GameLogicInteractionServer extends GameLogicInteraction {
	public override permission: GameLogicPermissionServer;

	constructor(character: GameLogicCharacter, id: InteractionId, data: InteractionData) {
		super();
		const config: Immutable<IInteractionConfig> = INTERACTION_CONFIG[id];

		this.permission = new GameLogicPermissionServer(character, {
			group: 'interaction',
			id,
			displayName: config.visibleName,
			icon: config.icon,
			defaultConfig: config.defaultPermissions,
			forbidDefaultAllowOthers: config.forbidDefaultAllowOthers,
			maxCharacterOverrides: config.maxCharacterOverrides,
		}, data.permissionConfig);

		this.permission.on('configChanged', () => {
			this.emit('configChanged', undefined);
		});
	}

	public getConfig(): InteractionData {
		return {
			permissionConfig: this.permission.getConfig(),
		};
	}
}
