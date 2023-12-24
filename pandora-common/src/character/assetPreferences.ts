import { z } from 'zod';
import type { Immutable } from 'immer';
import { AssetIdSchema } from '../assets/base';
import type { Asset } from '../assets/asset';
import type { CharacterId } from './characterTypes';
import { KnownObject } from '../utility';
import { AssetManager } from '../assets';

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

/**
 * Cleans up the asset preferences in-place by removing invalid entries
 * @param assetManager - Asset manager to use for queries
 * @param preferences - The preferences object to cleanup
 * @param allowBaseState - If the object is allowed to contain the default values, or if default values need to be missing (and be implicit)
 * @returns If the original object was invalid - some entries were removed
 */
export function CleanupAssetPreferences(assetManager: AssetManager, {
	attributes = {},
	assets = {},
}: Partial<AssetPreferences>, allowBaseState: boolean): boolean {
	let hasInvalid = false;

	for (const key of KnownObject.keys(attributes)) {
		const attribute = assetManager.attributes.get(key);
		if (attribute == null
			|| attribute.useAsAssetPreference === false
			|| attribute.useAsWardrobeFilter?.tab === 'room'
		) {
			delete attributes[key];
			hasInvalid = true;
			continue;
		}
		if (!allowBaseState && Object.keys(attributes[key]).length === 1 && attributes[key].base === 'normal') {
			delete attributes[key];
			hasInvalid = true;
			continue;
		}
	}

	for (const [key, value] of KnownObject.entries(assets)) {
		if (value === undefined) {
			delete assets[key];
			hasInvalid = true;
			continue;
		}
		const asset = assetManager.getAssetById(key);
		if (asset == null) {
			delete assets[key];
			hasInvalid = true;
			continue;
		}

		switch (asset.type) {
			case 'roomDevice':
			case 'roomDeviceWearablePart':
				// TODO: allow wearable parts?
				delete assets[key];
				hasInvalid = true;
				continue;
			case 'personal':
			case 'lock':
				break;
		}
		if (!allowBaseState && KnownObject.keys(value).length === 1 && value.base === 'normal') {
			let hasAttribute = false;
			for (const attribute of asset.staticAttributes) {
				if (attributes[attribute] != null) {
					hasAttribute = true;
					break;
				}
			}
			if (!hasAttribute) {
				delete assets[key];
				hasInvalid = true;
				continue;
			}
		}
	}

	return hasInvalid;
}
