import { ASSET_PREFERENCES_DEFAULT, ResolveAssetPreference, type Asset } from 'pandora-common';
import { useCallback } from 'react';
import { usePlayerData } from '../../components/gameContext/playerContextProvider.tsx';

export function useAssetPreferenceVisibilityCheck(): (asset: Asset) => boolean {
	const preferences = usePlayerData()?.assetPreferences ?? ASSET_PREFERENCES_DEFAULT;
	return useCallback((asset: Asset): boolean => {
		const resolution = ResolveAssetPreference(preferences, asset);
		if (resolution.preference === 'doNotRender')
			return false;
		return true;
	}, [preferences]);
}
