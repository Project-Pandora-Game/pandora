import type { Immutable } from 'immer';
import type { AssetPreferences, ICharacterData } from '../../character';
import { Logger } from '../../logging';
import { AssertNever } from '../../utility';
import { MakeDefaultInteractionSystemData } from '../interactions/interactionData';
import { InteractionSubsystemServer } from '../interactions/interactionSubsystemServer';
import { GameLogicPermissionServer, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterServer extends GameLogicCharacter {
	private readonly _data: ICharacterData;

	public override readonly interactions: InteractionSubsystemServer;

	public override get assetPreferences(): Immutable<AssetPreferences> {
		return this._data.assetPreferences;
	}

	constructor(data: ICharacterData, logger: Logger) {
		super(data);
		this._data = data;
		this.interactions = new InteractionSubsystemServer(
			this,
			data.interactionConfig ?? MakeDefaultInteractionSystemData(),
			logger.prefixMessages('[InteractionSubsystem]'),
		);

		this.interactions.on('dataChanged', () => {
			this.emit('dataChanged', 'interactions');
		});
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionServer> {
		switch (permissionGroup) {
			case 'interaction':
				return this.interactions;
			default:
				AssertNever(permissionGroup);
		}
	}

	public override getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermissionServer | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
