import type { Logger } from '../../logging/logger.ts';
import { AssertNotNullable } from '../../utility/misc.ts';
import { ArrayIncludesGuard } from '../../validation.ts';
import type { GameLogicCharacter } from '../character/character.ts';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions/index.ts';
import { INTERACTION_IDS, InteractionId } from './_interactionConfig.ts';
import { GameLogicInteractionServer } from './interaction.ts';
import { InteractionData, InteractionSystemData } from './interactionData.ts';
import { InteractionSubsystem } from './interactionSubsystem.ts';

export class InteractionSubsystemServer extends InteractionSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	private readonly interactions: ReadonlyMap<InteractionId, GameLogicInteractionServer>;

	constructor(character: GameLogicCharacter, data: InteractionSystemData, logger: Logger) {
		super();
		// Load data
		const interactions = new Map<InteractionId, GameLogicInteractionServer>();
		for (const id of INTERACTION_IDS) {
			let interactionData: InteractionData | undefined = data.config[id];
			if (interactionData == null) {
				logger.verbose(`Adding missing interaction data for '${id}'`);
				interactionData = {
					permissionConfig: null,
				};
			}
			interactions.set(id, new GameLogicInteractionServer(character, id, interactionData));
		}
		this.interactions = interactions;
		// Report ignored configs
		for (const dataId of Object.keys(data.config)) {
			if (!ArrayIncludesGuard(INTERACTION_IDS, dataId)) {
				logger.warning(`Ignoring unknown interaction config '${dataId}'`);
			}
		}

		// Link up events
		for (const interaction of this.interactions.values()) {
			interaction.on('configChanged', () => {
				this.emit('dataChanged', undefined);
			});
		}
	}

	public getData(): InteractionSystemData {
		const data: InteractionSystemData = {
			config: {},
		};

		for (const [id, interaction] of this.interactions.entries()) {
			data.config[id] = interaction.getConfig();
		}

		return data;
	}

	public override getInteractionPermission(permissionId: InteractionId): GameLogicPermissionServer {
		const interaction = this.interactions.get(permissionId);
		AssertNotNullable(interaction);

		return interaction.permission;
	}

	public override getPermission(permissionId: string): GameLogicPermissionServer | null {
		if (!ArrayIncludesGuard(INTERACTION_IDS, permissionId)) {
			return null;
		}

		return this.getInteractionPermission(permissionId);
	}
}
