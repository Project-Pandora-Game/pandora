import { Immutable } from 'immer';
import type { Asset } from '../../assets/asset.ts';
import { AssetPreferenceResolution, AssetPreferenceType, AssetPreferencesPublic, ResolveAssetPreference } from '../../character/assetPreferences.ts';
import { CharacterId } from '../../character/characterTypes.ts';
import { TypedEventEmitter } from '../../event.ts';
import { GameLogicPermission, IPermissionProvider, PermissionConfigDefault } from '../permissions/index.ts';

export type AssetPreferencesSubsystemEvents = {
	dataChanged: void;
};

export const ASSET_PREFERENCES_PERMISSIONS = {
	favorite: {
		visibleName: 'Favorite',
		icon: 'star',
		defaultPermissions: {
			allowOthers: 'yes',
		},
	},
	normal: {
		visibleName: 'Normal',
		icon: 'arrow-right',
		defaultPermissions: {
			allowOthers: 'yes',
		},
	},
	maybe: {
		visibleName: 'Maybe',
		icon: 'questionmark',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
	},
	prevent: null,
	doNotRender: null,
} as const satisfies Immutable<Record<AssetPreferenceType, AssetPreferencePermissionConfig | null>>;

export interface AssetPreferencePermissionConfig {
	visibleName: string;
	icon: string;
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
