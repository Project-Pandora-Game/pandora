import type { Immutable } from 'immer';
import { Logger } from '../../logging';
import type { ICharacterRoomData } from '../../networking/shard_client';
import { AssertNever } from '../../utility/misc';
import { AssetPreferencesSubsystemClient } from '../assetPreferences';
import { CharacterModifiersSubsystemClient } from '../characterModifiers/characterModifiersSubsystemClient';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterClient extends GameLogicCharacter {
	public readonly _dataGetter: () => Immutable<ICharacterRoomData>;

	public override readonly interactions: InteractionSubsystemClient;
	public override readonly assetPreferences: AssetPreferencesSubsystemClient;
	public override readonly characterModifiers: CharacterModifiersSubsystemClient;

	constructor(dataGetter: (() => Immutable<ICharacterRoomData>), _logger: Logger) {
		super(dataGetter());
		this._dataGetter = dataGetter;
		this.interactions = new InteractionSubsystemClient(this);
		this.assetPreferences = new AssetPreferencesSubsystemClient(this);
		this.characterModifiers = new CharacterModifiersSubsystemClient(this);
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionClient> {
		switch (permissionGroup) {
			case 'assetPreferences':
				return this.assetPreferences;
			case 'interaction':
				return this.interactions;
			case 'characterModifierType':
				return this.characterModifiers;
			default:
				AssertNever(permissionGroup);
		}
	}

	public override getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermissionClient | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
