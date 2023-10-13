import { ArrayIncludesGuard } from '../../validation';
import { GameLogicPermission, IPermissionProvider } from '../permissions';
import { INTERACTION_IDS, InteractionId } from './_interactionConfig';

export abstract class InteractionSubsystem implements IPermissionProvider {
	public abstract getInteractionPermission(interaction: InteractionId): GameLogicPermission;

	public getPermission(permissionId: string): GameLogicPermission | null {
		if (!ArrayIncludesGuard(INTERACTION_IDS, permissionId)) {
			return null;
		}

		return this.getInteractionPermission(permissionId);
	}
}
