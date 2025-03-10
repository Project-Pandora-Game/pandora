import { AccountId } from '../../account/index.ts';
import type { AssetFrameworkGlobalState } from '../../assets/index.ts';
import { CharacterAppearance } from '../../assets/appearance.ts';
import { CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character/index.ts';
import { TypedEventEmitter } from '../../event.ts';
import type { ActionSpaceContext } from '../../space/space.ts';
import { AssetPreferencesSubsystem } from '../assetPreferences/index.ts';
import type { CharacterModifiersSubsystem } from '../characterModifiers/characterModifiersSubsystem.ts';
import { InteractionSubsystem } from '../interactions/interactionSubsystem.ts';
import { GameLogicPermission, IPermissionProvider, PermissionGroup } from '../permissions/index.ts';

export type GameLogicCharacterEvents = {
	dataChanged: 'interactions' | 'assetPreferences' | 'characterModifiers';
};

export abstract class GameLogicCharacter extends TypedEventEmitter<GameLogicCharacterEvents> {
	public readonly id: CharacterId;
	public readonly accountId: AccountId;
	public readonly name: string;

	public readonly abstract interactions: InteractionSubsystem;
	public readonly abstract assetPreferences: AssetPreferencesSubsystem;
	public readonly abstract characterModifiers: CharacterModifiersSubsystem;

	constructor(minimalData: ICharacterMinimalData) {
		super();
		this.id = minimalData.id;
		this.accountId = minimalData.accountId;
		this.name = minimalData.name;
	}

	public getAppearance(gameState: AssetFrameworkGlobalState): CharacterAppearance {
		return new CharacterAppearance(gameState, this);
	}

	public getRestrictionManager(gameState: AssetFrameworkGlobalState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(gameState).getRestrictionManager(spaceContext);
	}

	protected abstract _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider;
	public abstract getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermission | null;
}
