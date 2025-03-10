import type { Immutable } from 'immer';
import { z } from 'zod';
import type { Asset } from '../assets/asset.ts';
import type { AssetManager } from '../assets/assetManager.ts';
import { AssetId, AssetIdSchema } from '../assets/base.ts';
import { PermissionConfigSchema } from '../gameLogic/permissions/permissionData.ts';
import { KnownObject } from '../utility/misc.ts';
import { ZodMatcher } from '../validation.ts';
import type { CharacterId } from './characterTypes.ts';

export const AssetPreferenceTypeSchema = z.enum(['favorite', 'normal', 'maybe', 'prevent', 'doNotRender']);
export type AssetPreferenceType = z.infer<typeof AssetPreferenceTypeSchema>;
export const IsAssetPreferenceType = ZodMatcher(AssetPreferenceTypeSchema);

export const AttributePreferenceTypeSchema = AssetPreferenceTypeSchema.and(z.enum(['normal', 'maybe', 'prevent', 'doNotRender']));
export type AttributePreferenceType = z.infer<typeof AttributePreferenceTypeSchema>;

export const AttributePreferenceSchema = z.object({
	base: AttributePreferenceTypeSchema.default('normal'),
});
export type AttributePreference = z.infer<typeof AttributePreferenceSchema>;

export const AssetPreferenceSchema = z.object({
	base: AssetPreferenceTypeSchema.default('normal'),
});
export type AssetPreference = z.infer<typeof AssetPreferenceSchema>;

export const AssetPreferencesPublicSchema = z.object({
	attributes: z.record(z.string(), AttributePreferenceSchema).default({}),
	assets: z.record(AssetIdSchema, AssetPreferenceSchema).default({}),
});
export type AssetPreferencesPublic = z.infer<typeof AssetPreferencesPublicSchema>;

export const AssetPreferencesServerSchema = AssetPreferencesPublicSchema.extend({
	permissions: z.record(AssetPreferenceTypeSchema, PermissionConfigSchema.nullable().catch(null)).default(() => ({})),
});
export type AssetPreferencesServer = z.infer<typeof AssetPreferencesServerSchema>;

export const ASSET_PREFERENCES_DEFAULT: Readonly<AssetPreferencesServer> = Object.freeze<AssetPreferencesServer>({
	attributes: {},
	assets: {},
	permissions: {},
});

export type AssetPreferenceResolution = {
	type: 'attribute';
	attribute: string;
	preference: AssetPreferenceType;
} | {
	type: 'asset';
	asset: AssetId;
	preference: AssetPreferenceType;
};

export function ResolveAssetPreference(preferences: Immutable<AssetPreferencesPublic>, asset: Asset, _source?: CharacterId): AssetPreferenceResolution {
	const assetPreference = preferences.assets[asset.id];
	if (assetPreference != null) {
		return {
			type: 'asset',
			asset: asset.id,
			preference: assetPreference.base,
		};
	}
	if (asset.definition.assetPreferenceDefault != null) {
		return {
			type: 'asset',
			asset: asset.id,
			preference: asset.definition.assetPreferenceDefault,
		};
	}

	let result: AssetPreferenceResolution = {
		type: 'asset',
		asset: asset.id,
		preference: 'normal',
	};
	for (const attribute of asset.staticAttributes) {
		const attributePreference = preferences.attributes[attribute];
		if (attributePreference != null) {
			const previous = AssetPreferenceTypeSchema.options.indexOf(result.preference);
			const base = AssetPreferenceTypeSchema.options.indexOf(attributePreference.base);
			if (base > previous) {
				result = {
					type: 'attribute',
					attribute,
					preference: attributePreference.base,
				};
			}
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
}: Partial<AssetPreferencesServer>): boolean {
	let hasInvalid = false;

	for (const key of KnownObject.keys(attributes)) {
		const attribute = assetManager.attributes.get(key);
		if (attribute == null || attribute.useAsAssetPreference === false) {
			delete attributes[key];
			hasInvalid = true;
			continue;
		}
		// Never allow "default" value for attributes (act sparsely)
		if (Object.keys(attributes[key] ?? {}).length === 1 && attributes[key]?.base === 'normal') {
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
			case 'bodypart':
			case 'personal':
			case 'lock':
				break;
		}
	}

	return hasInvalid;
}
