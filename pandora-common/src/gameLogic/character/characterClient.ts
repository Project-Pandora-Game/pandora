import { ICharacterPublicData } from '../../character';
import { Logger } from '../../logging';
import { AssertNever } from '../../utility';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterClient extends GameLogicCharacter {
	public override readonly interactions: InteractionSubsystemClient;

	constructor(data: ICharacterPublicData, _logger: Logger) {
		super(data);
		this.interactions = new InteractionSubsystemClient(
			this,
		);
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionClient> {
		switch (permissionGroup) {
			case 'interaction':
				return this.interactions;
			default:
				AssertNever(permissionGroup);
		}
	}

	public override getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermissionClient | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
