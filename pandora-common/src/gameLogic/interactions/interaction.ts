import { TypedEventEmitter } from '../../event';
import { GameLogicCharacter } from '../character';
import { GameLogicPermission, GameLogicPermissionServer } from '../permissions';
import { GameLogicPermissionClient } from '../permissions/permissionClient';
import { INTERACTION_CONFIG, InteractionId } from './_interactionConfig';
import { InteractionData } from './interactionData';

export type GameLogicInteractionEvents = {
	configChanged: true;
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
		const config = INTERACTION_CONFIG[id];

		this.permission = new GameLogicPermissionClient(character, {
			group: 'interaction',
			id,
			displayName: `Interaction: ${config.visibleName}`,
			defaultConfig: config.defaultPermissions,
		});
	}
}

export class GameLogicInteractionServer extends GameLogicInteraction {
	public override permission: GameLogicPermissionServer;

	constructor(character: GameLogicCharacter, id: InteractionId, data: InteractionData) {
		super();
		const config = INTERACTION_CONFIG[id];

		this.permission = new GameLogicPermissionServer(character, {
			group: 'interaction',
			id,
			displayName: `Interaction: ${config.visibleName}`,
			defaultConfig: config.defaultPermissions,
		}, data.permissionConfig);
	}
}
