import { AssetPreferences, CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character';
import { AccountId } from '../../account';
import { TypedEventEmitter } from '../../event';
import { InteractionSubsystem } from '../interactions/interactionSubsystem';
import { AssetFrameworkCharacterState, CharacterAppearance } from '../../assets';
import { Assert } from '../../utility';
import { ActionRoomContext } from '../../chatroom';
import { GameLogicPermission, IPermissionProvider, PermissionGroup } from '../permissions';
import type { Immutable } from 'immer';

export type GameLogicCharacterEvents = {
	dataChanged: 'interactions';
};

export abstract class GameLogicCharacter extends TypedEventEmitter<GameLogicCharacterEvents> {
	public readonly id: CharacterId;
	public readonly accountId: AccountId;
	public readonly name: string;

	public readonly abstract interactions: InteractionSubsystem;
	public readonly abstract assetPreferences: Immutable<AssetPreferences>;

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

	public getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}

	protected abstract _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider;
	public abstract getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermission | null;
}
