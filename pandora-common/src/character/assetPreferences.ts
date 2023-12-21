import { z } from 'zod';
import type { Immutable } from 'immer';
import { AssetIdSchema } from '../assets/base';
import type { Asset } from '../assets/asset';
import type { CharacterId } from './characterTypes';

export const AttributePreferenceTypeSchema = z.enum(['normal', 'prevent', 'doNotRender']);
export type AttributePreferenceType = z.infer<typeof AttributePreferenceTypeSchema>;

export const AttributePreferenceSchema = z.object({
	base: AttributePreferenceTypeSchema.default('normal'),
});
export type AttributePreference = z.infer<typeof AttributePreferenceSchema>;

export const AssetPreferenceTypeSchema = z.enum(['favorite', 'normal', 'maybe', 'prevent', 'doNotRender']);
export type AssetPreferenceType = z.infer<typeof AssetPreferenceTypeSchema>;

export const AssetPreferenceSchema = z.object({
	base: AssetPreferenceTypeSchema.default('normal'),
});
export type AssetPreference = z.infer<typeof AssetPreferenceSchema>;

export const AssetPreferencesSchema = z.object({
	attributes: z.record(z.string(), AttributePreferenceSchema).default({}),
	assets: z.record(AssetIdSchema, AssetPreferenceSchema).default({}),
});
export type AssetPreferences = z.infer<typeof AssetPreferencesSchema>;

export const ASSET_PREFERENCES_DEFAULT: Readonly<AssetPreferences> = Object.freeze<AssetPreferences>({
	attributes: {},
	assets: {},
});

export function ResolveAssetPreference(preferences: Immutable<AssetPreferences>, asset: Asset, _source?: CharacterId): AssetPreferenceType {
	const assetPreference = preferences.assets[asset.id];
	if (assetPreference != null)
		return assetPreference.base;

	let result: AssetPreferenceType = 'normal';
	for (const attribute of asset.staticAttributes) {
		if (preferences.attributes[attribute] != null) {
			const previous = AssetPreferenceTypeSchema.options.indexOf(result);
			const base = AssetPreferenceTypeSchema.options.indexOf(preferences.attributes[attribute].base);
			if (base > previous)
				result = preferences.attributes[attribute].base;
		}
	}

	return result;
}
