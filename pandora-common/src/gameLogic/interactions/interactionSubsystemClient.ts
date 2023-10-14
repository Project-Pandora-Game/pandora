import { AssertNotNullable } from '../../utility';
import { ArrayIncludesGuard } from '../../validation';
import { GameLogicCharacter } from '../character';
import { IPermissionProvider } from '../permissions';
import { GameLogicPermissionClient } from '../permissions/permissionClient';
import { INTERACTION_IDS, InteractionId } from './_interactionConfig';
import { GameLogicInteractionClient } from './interaction';
import { InteractionSubsystem } from './interactionSubsystem';

export class InteractionSubsystemClient extends InteractionSubsystem implements IPermissionProvider<GameLogicPermissionClient> {
	private readonly interactions: ReadonlyMap<InteractionId, GameLogicInteractionClient>;

	constructor(character: GameLogicCharacter) {
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
