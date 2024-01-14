import { AssetManager } from '../../assets';
import type { ICharacterData } from '../../character';
import { Logger } from '../../logging';
import { AssertNever } from '../../utility';
import { AssetPreferencesSubsystemServer } from '../assetPreferences';
import { MakeDefaultInteractionSystemData } from '../interactions/interactionData';
import { InteractionSubsystemServer } from '../interactions/interactionSubsystemServer';
import { GameLogicPermissionServer, IPermissionProvider, PermissionGroup } from '../permissions';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterServer extends GameLogicCharacter {
	public readonly _data: ICharacterData;

	public override readonly interactions: InteractionSubsystemServer;
	public override readonly assetPreferences: AssetPreferencesSubsystemServer;

	constructor(data: ICharacterData, assetManager: AssetManager, logger: Logger) {
		super(data);
		this._data = data;
		this.interactions = new InteractionSubsystemServer(
			this,
			data.interactionConfig ?? MakeDefaultInteractionSystemData(),
			logger.prefixMessages('[InteractionSubsystem]'),
		);
		this.assetPreferences = new AssetPreferencesSubsystemServer(
			this,
			data.assetPreferences,
			assetManager,
		);

		this.interactions.on('dataChanged', () => {
			this.emit('dataChanged', 'interactions');
		});
		this.assetPreferences.on('dataChanged', () => {
			this.emit('dataChanged', 'assetPreferences');
		});
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionServer> {
		switch (permissionGroup) {
			case 'assetPreferences':
				return this.assetPreferences;
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
