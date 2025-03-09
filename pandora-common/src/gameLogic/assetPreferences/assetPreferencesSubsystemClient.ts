import { Immutable } from 'immer';
import { AssetPreferenceType, AssetPreferencesPublic, IsAssetPreferenceType } from '../../character/index.ts';
import { KnownObject } from '../../utility/misc.ts';
import type { GameLogicCharacterClient } from '../character/characterClient.ts';
import { IPermissionProvider } from '../permissions/index.ts';
import { GameLogicPermissionClient } from '../permissions/permissionClient.ts';
import { ASSET_PREFERENCES_PERMISSIONS, AssetPreferencesSubsystem } from './assetPreferencesSubsystem.ts';

export class AssetPreferencesSubsystemClient extends AssetPreferencesSubsystem implements IPermissionProvider<GameLogicPermissionClient> {
	private readonly _character: GameLogicCharacterClient;
	private readonly _permissions: ReadonlyMap<AssetPreferenceType, GameLogicPermissionClient>;

	public override get currentPreferences(): Immutable<AssetPreferencesPublic> {
		return this._character._dataGetter().assetPreferences;
	}

	constructor(character: GameLogicCharacterClient) {
		super();
		this._character = character;
		// Load permissions
		const permissions = new Map<AssetPreferenceType, GameLogicPermissionClient>();
		for (const [preference, config] of KnownObject.entries(ASSET_PREFERENCES_PERMISSIONS)) {
			if (config == null)
				continue;

			permissions.set(
				preference,
				new GameLogicPermissionClient(character, {
					group: 'assetPreferences',
					id: preference,
					displayName: `Interact with worn items that are marked as "${config.visibleName}"`,
					icon: config.icon,
					defaultConfig: config.defaultPermissions,
				}),
			);
		}
		this._permissions = permissions;
	}

	public override getPreferencePermission(preference: AssetPreferenceType): GameLogicPermissionClient | null {
		return this._permissions.get(preference) ?? null;
	}

	public override getPermission(permissionId: string): GameLogicPermissionClient | null {
		if (!IsAssetPreferenceType(permissionId)) {
			return null;
		}

		return this.getPreferencePermission(permissionId);
	}
}
