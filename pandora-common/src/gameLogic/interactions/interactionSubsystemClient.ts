import { AssertNotNullable } from '../../utility/misc.ts';
import { ArrayIncludesGuard } from '../../validation.ts';
import type { GameLogicCharacterClient } from '../character/characterClient.ts';
import { IPermissionProvider } from '../permissions/index.ts';
import { GameLogicPermissionClient } from '../permissions/permissionClient.ts';
import { INTERACTION_IDS, InteractionId } from './_interactionConfig.ts';
import { GameLogicInteractionClient } from './interaction.ts';
import { InteractionSubsystem } from './interactionSubsystem.ts';

export class InteractionSubsystemClient extends InteractionSubsystem implements IPermissionProvider<GameLogicPermissionClient> {
	private readonly interactions: ReadonlyMap<InteractionId, GameLogicInteractionClient>;

	constructor(character: GameLogicCharacterClient) {
		super();
		// Load interactions
		const interactions = new Map<InteractionId, GameLogicInteractionClient>();
		for (const id of INTERACTION_IDS) {
			interactions.set(id, new GameLogicInteractionClient(character, id));
		}
		this.interactions = interactions;
	}

	public override getInteractionPermission(permissionId: InteractionId): GameLogicPermissionClient {
		const interaction = this.interactions.get(permissionId);
		AssertNotNullable(interaction);

		return interaction.permission;
	}

	public override getPermission(permissionId: string): GameLogicPermissionClient | null {
		if (!ArrayIncludesGuard(INTERACTION_IDS, permissionId)) {
			return null;
		}

		return this.getInteractionPermission(permissionId);
	}
}
