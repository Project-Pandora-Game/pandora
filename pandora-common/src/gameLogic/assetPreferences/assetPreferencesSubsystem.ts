import { Immutable } from 'immer';
import { Asset } from '../../assets/asset';
import { AssetPreferenceResolution, AssetPreferenceType, AssetPreferencesPublic, ResolveAssetPreference } from '../../character/assetPreferences';
import { CharacterId } from '../../character/characterTypes';
import { TypedEventEmitter } from '../../event';
import { GameLogicPermission, IPermissionProvider, PermissionConfigDefault } from '../permissions';

export type AssetPreferencesSubsystemEvents = {
	dataChanged: void;
};

export const ASSET_PREFERENCES_PERMISSIONS = {
	favorite: {
		visibleName: 'Add and remove assets with favorite preference',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	normal: {
		visibleName: 'Add and remove assets with normal preference',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	maybe: {
		visibleName: 'Add and remove assets with maybe preference',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	prevent: null,
	doNotRender: null,
} as const satisfies Immutable<Record<AssetPreferenceType, AssetPreferencePermissionConfig | null>>;

export interface AssetPreferencePermissionConfig {
	visibleName: string;
	defaultPermissions: PermissionConfigDefault;
}

export abstract class AssetPreferencesSubsystem extends TypedEventEmitter<AssetPreferencesSubsystemEvents> implements IPermissionProvider {
	public abstract get currentPreferences(): Immutable<AssetPreferencesPublic>;
	public abstract getPreferencePermission(preference: AssetPreferenceType): GameLogicPermission | null;
	public abstract getPermission(permissionId: string): GameLogicPermission | null;

	public resolveAssetPreference(asset: Asset, source?: CharacterId): AssetPreferenceResolution {
		return ResolveAssetPreference(this.currentPreferences, asset, source);
	}
}
