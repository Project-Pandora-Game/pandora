import { AccountId } from '../../account';
import { CharacterAppearance } from '../../assets/appearance';
import { AssetFrameworkCharacterState } from '../../assets/state/characterState';
import { CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character';
import { TypedEventEmitter } from '../../event';
import type { ActionSpaceContext } from '../../space/space';
import { Assert } from '../../utility';
import { AssetPreferencesSubsystem } from '../assetPreferences';
import { InteractionSubsystem } from '../interactions/interactionSubsystem';
import { GameLogicPermission, IPermissionProvider, PermissionGroup } from '../permissions';

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
