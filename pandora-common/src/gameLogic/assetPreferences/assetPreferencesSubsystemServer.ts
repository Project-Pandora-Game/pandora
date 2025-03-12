import { Immutable, freeze } from 'immer';
import type { AssetManager } from '../../assets/assetManager.ts';
import { AssetPreferenceType, AssetPreferencesPublic, AssetPreferencesServer, CleanupAssetPreferences, IsAssetPreferenceType } from '../../character/assetPreferences.ts';
import { CloneDeepMutable, KnownObject } from '../../utility/misc.ts';
import type { GameLogicCharacterServer } from '../character/characterServer.ts';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions/index.ts';
import { ASSET_PREFERENCES_PERMISSIONS, AssetPreferencesSubsystem } from './assetPreferencesSubsystem.ts';

export class AssetPreferencesSubsystemServer extends AssetPreferencesSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	private readonly _permissions: ReadonlyMap<AssetPreferenceType, GameLogicPermissionServer>;

	private _publicPreferences: Immutable<AssetPreferencesPublic>;

	public override get currentPreferences(): Immutable<AssetPreferencesPublic> {
		return this._publicPreferences;
	}

	constructor(character: GameLogicCharacterServer, data: AssetPreferencesServer, assetManager: AssetManager) {
		super();
		// Load and cleanup preferences data
		this._publicPreferences = CloneDeepMutable({
			assets: data.assets,
			attributes: data.attributes,
		});
		CleanupAssetPreferences(assetManager, this._publicPreferences);
		freeze(this._publicPreferences, true);

		// Load permissions
		const permissions = new Map<AssetPreferenceType, GameLogicPermissionServer>();
		for (const [preference, config] of KnownObject.entries(ASSET_PREFERENCES_PERMISSIONS)) {
			if (config == null)
				continue;

			permissions.set(
				preference,
				new GameLogicPermissionServer(character, {
					group: 'assetPreferences',
					id: preference,
					displayName: `Interact with worn items that are marked as "${config.visibleName}"`,
					icon: config.icon,
					defaultConfig: config.defaultPermissions,
				}, data.permissions[preference] ?? null),
			);
		}
		this._permissions = permissions;

		// Link up events
		for (const permission of this._permissions.values()) {
			permission.on('configChanged', () => {
				this.emit('dataChanged', undefined);
			});
		}
	}

	public setPreferences(newPreferences: Immutable<AssetPreferencesPublic>): void {
		this._publicPreferences = freeze(newPreferences, true);
		this.emit('dataChanged', undefined);
	}

	public getData(): AssetPreferencesServer {
		const data: AssetPreferencesServer = {
			assets: this._publicPreferences.assets,
			attributes: this._publicPreferences.attributes,
			permissions: {},
		};

		for (const [id, permission] of this._permissions.entries()) {
			data.permissions[id] = permission.getConfig();
		}

		return data;
	}

	public reloadAssetManager(manager: AssetManager) {
		// Cleanup preferences data based on mew manager
		this._publicPreferences = CloneDeepMutable(this._publicPreferences);
		const changed = CleanupAssetPreferences(manager, this._publicPreferences);
		freeze(this._publicPreferences, true);
		if (changed) {
			this.emit('dataChanged', undefined);
		}
	}

	public override getPreferencePermission(preference: AssetPreferenceType): GameLogicPermissionServer | null {
		return this._permissions.get(preference) ?? null;
	}

	public override getPermission(permissionId: string): GameLogicPermissionServer | null {
		if (!IsAssetPreferenceType(permissionId)) {
			return null;
		}

		return this.getPreferencePermission(permissionId);
	}
}
