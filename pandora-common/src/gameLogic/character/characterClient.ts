import type { Immutable } from 'immer';
import type { Logger } from '../../logging/logger.ts';
import type { ICharacterRoomData } from '../../networking/shard_client.ts';
import { AssertNever } from '../../utility/misc.ts';
import { AssetPreferencesSubsystemClient } from '../assetPreferences/index.ts';
import { CharacterModifiersSubsystemClient } from '../characterModifiers/characterModifiersSubsystemClient.ts';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient.ts';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions/index.ts';
import { GameLogicCharacter } from './character.ts';

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
