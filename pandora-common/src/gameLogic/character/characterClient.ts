import type { Immutable } from 'immer';
import { Logger } from '../../logging';
import { AssertNever } from '../../utility';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';
import { AssetPreferencesSubsystemClient } from '../assetPreferences';
import { ICharacterRoomData } from '../../networking';

export class GameLogicCharacterClient extends GameLogicCharacter {
	public readonly _dataGetter: () => Immutable<ICharacterRoomData>;

	public override readonly interactions: InteractionSubsystemClient;
	public override readonly assetPreferences: AssetPreferencesSubsystemClient;

	constructor(dataGetter: (() => Immutable<ICharacterRoomData>), _logger: Logger) {
		super(dataGetter());
		this._dataGetter = dataGetter;
		this.interactions = new InteractionSubsystemClient(this);
		this.assetPreferences = new AssetPreferencesSubsystemClient(this);
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionClient> {
		switch (permissionGroup) {
			case 'assetPreferences':
				return this.assetPreferences;
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
