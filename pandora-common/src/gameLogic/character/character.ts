import { CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character';
import { AccountId } from '../../account';
import { TypedEventEmitter } from '../../event';
import { InteractionSubsystem } from '../interactions/interactionSubsystem';
import { AssetFrameworkCharacterState, CharacterAppearance } from '../../assets';
import { Assert, AssertNever } from '../../utility';
import { ActionRoomContext } from '../../chatroom';
import { GameLogicPermission, IPermissionProvider, PermissionGroup } from '../permissions';

export type GameLogicCharacterEvents = {
	dataChanged: 'interactions';
};

export abstract class GameLogicCharacter extends TypedEventEmitter<GameLogicCharacterEvents> {
	public readonly id: CharacterId;
	public readonly accountId: AccountId;
	public readonly name: string;

	public readonly abstract interactions: InteractionSubsystem;

	constructor(minimalData: ICharacterMinimalData) {
		super();
		this.id = minimalData.id;
		this.accountId = minimalData.accountId;
		this.name = minimalData.name;
	}

	public getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance {
		Assert(state.id === this.id);
		return new CharacterAppearance(state, this);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext | null): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}

	protected _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider {
		switch (permissionGroup) {
			case 'interaction':
				return this.interactions;
			default:
				AssertNever(permissionGroup);
		}
	}

	public getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermission | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
