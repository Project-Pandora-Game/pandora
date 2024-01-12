import { CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character';
import { AccountId } from '../../account';
import { TypedEventEmitter } from '../../event';
import { InteractionSubsystem } from '../interactions/interactionSubsystem';
import { AssetFrameworkCharacterState, CharacterAppearance } from '../../assets';
import { Assert } from '../../utility';
import { ActionSpaceContext } from '../../space/space';
import { GameLogicPermission, IPermissionProvider, PermissionGroup } from '../permissions';
import { AssetPreferencesSubsystem } from '../assetPreferences';

export type GameLogicCharacterEvents = {
	dataChanged: 'interactions' | 'assetPreferences';
};

export abstract class GameLogicCharacter extends TypedEventEmitter<GameLogicCharacterEvents> {
	public readonly id: CharacterId;
	public readonly accountId: AccountId;
	public readonly name: string;

	public readonly abstract interactions: InteractionSubsystem;
	public readonly abstract assetPreferences: AssetPreferencesSubsystem;

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

	public getRestrictionManager(state: AssetFrameworkCharacterState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(spaceContext);
	}

	protected abstract _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider;
	public abstract getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermission | null;
}
