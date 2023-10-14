import { TypedEventEmitter } from '../../event';
import { GameLogicPermission, IPermissionProvider } from '../permissions';
import { InteractionId } from './_interactionConfig';

export type InteractionSubsystemEvents = {
	dataChanged: void;
};

export abstract class InteractionSubsystem extends TypedEventEmitter<InteractionSubsystemEvents> implements IPermissionProvider {

	constructor() {
		super();
	}

	public abstract getInteractionPermission(interaction: InteractionId): GameLogicPermission;
	public abstract getPermission(permissionId: string): GameLogicPermission | null;
}
