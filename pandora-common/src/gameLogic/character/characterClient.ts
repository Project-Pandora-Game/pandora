import type { Immutable } from 'immer';
import type { AssetPreferences, ICharacterPublicData } from '../../character';
import { Logger } from '../../logging';
import { AssertNever } from '../../utility';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterClient extends GameLogicCharacter {
	private readonly _dataGetter: () => Immutable<ICharacterPublicData>;

	public override readonly interactions: InteractionSubsystemClient;

	public override get assetPreferences(): Immutable<AssetPreferences> {
		return this._dataGetter().assetPreferences;
	}

	constructor(dataGetter: (() => Immutable<ICharacterPublicData>), _logger: Logger) {
		super(dataGetter());
		this._dataGetter = dataGetter;
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
