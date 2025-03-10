import { TypedEventEmitter } from '../../event.ts';
import { GameLogicPermission, IPermissionProvider } from '../permissions/index.ts';
import { InteractionId } from './_interactionConfig.ts';

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
