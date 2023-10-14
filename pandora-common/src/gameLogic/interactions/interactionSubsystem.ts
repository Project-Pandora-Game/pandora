import { TypedEventEmitter } from '../../event';
import { ArrayIncludesGuard } from '../../validation';
import { GameLogicPermission, IPermissionProvider } from '../permissions';
import { INTERACTION_IDS, InteractionId } from './_interactionConfig';

export type InteractionSubsystemEvents = {
	dataChanged: void;
};

export abstract class InteractionSubsystem extends TypedEventEmitter<InteractionSubsystemEvents> implements IPermissionProvider {

	constructor() {
		super();
	}

	public abstract getInteractionPermission(interaction: InteractionId): GameLogicPermission;

	public getPermission(permissionId: string): GameLogicPermission | null {
		if (!ArrayIncludesGuard(INTERACTION_IDS, permissionId)) {
			return null;
		}

		return this.getInteractionPermission(permissionId);
	}
}
