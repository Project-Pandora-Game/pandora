import * as z from 'zod';
import { AccountIdSchema, type AccountId } from '../account/index.ts';
import { SpaceStateBundleSchema, type SpaceStateBundle } from '../assets/index.ts';
import { AppearanceBundleSchema, type AppearanceBundle } from '../assets/state/characterStateTypes.ts';
import { CharacterModifierSystemDataSchema, type CharacterModifierSystemData } from '../gameLogic/characterModifiers/characterModifierData.ts';
import { InteractionSystemDataSchema, type InteractionSystemData } from '../gameLogic/interactions/interactionData.ts';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits.ts';
import { SpaceIdSchema, type SpaceId } from '../space/space.ts';
import { ArrayToRecordKeys } from '../utility/misc.ts';
import { CharacterNameSchema, ZodTruncate, type ZodObjectShape } from '../validation.ts';
import { ASSET_PREFERENCES_DEFAULT, AssetPreferencesServerSchema, type AssetPreferencesServer } from './assetPreferences.ts';
import { CharacterSettingsSchema, type CharacterSettings } from './characterSettings.ts';
import { CharacterIdSchema, type CharacterId } from './characterTypes.ts';

/** Data about character, that is visible to everyone in the same space */
export interface ICharacterPublicData {
	id: CharacterId;
	accountId: AccountId;
	name: string;
	profileDescription: string;
}
/** Data about character, that is visible to everyone in the same space */
export const CharacterPublicDataSchema: z.ZodObject<ZodObjectShape<ICharacterPublicData>> = z.object({
	id: CharacterIdSchema,
	accountId: AccountIdSchema,
	name: CharacterNameSchema,
	profileDescription: z.string().transform(ZodTruncate(LIMIT_CHARACTER_PROFILE_LENGTH)).catch(''),
});

export type ICharacterMinimalData = Pick<ICharacterPublicData, 'id' | 'name' | 'accountId'>;

/** Data about character, that is visible only to the character itself */
export interface ICharacterPrivateData extends ICharacterPublicData {
	inCreation?: true;
	created: number;
	/**
	 * Settings of the account.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * Settings modified to the default are saved as well, so potential change of default wouldn't change the user-selected setting.
	 * This lets us both save on stored data, but also change defaults for users that never changed it themselves.
	 * Also lets us show non-default settings to users with a button to reset them.
	 */
	settings: Partial<CharacterSettings>;
}
/** Data about character, that is visible only to the character itself */
export const CharacterPrivateDataSchema: z.ZodObject<ZodObjectShape<ICharacterPrivateData>> = CharacterPublicDataSchema.extend({
	inCreation: z.literal(true).optional(),
	created: z.number(),
	settings: CharacterSettingsSchema.partial(),
});

/** Data about character, as seen by server.
 * All of this is persisted in the Pandora database
 **/
export interface ICharacterData extends ICharacterPrivateData {
	accessId: string;
	appearance?: AppearanceBundle;
	/**
	 * A character preview image, used in the character picker.
	 * Stored as binary data in database.
	 */
	preview?: unknown;
	/** The space the character is currently in. `null` means personal space. */
	currentSpace: SpaceId | null;
	personalSpace?: {
		spaceState: SpaceStateBundle;
	};
	interactionConfig?: InteractionSystemData;
	assetPreferences: AssetPreferencesServer;
	characterModifiers?: CharacterModifierSystemData;
}
/** Data about character, as seen by server.
 * All of this is persisted in the Pandora database
 **/
export const CharacterDataSchema: z.ZodObject<ZodObjectShape<ICharacterData>> = CharacterPrivateDataSchema.extend({
	accessId: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	preview: z.unknown().optional(),
	currentSpace: SpaceIdSchema.nullable().catch(null),
	personalSpace: z.object({
		spaceState: SpaceStateBundleSchema,
	}).optional(),
	interactionConfig: InteractionSystemDataSchema.optional(),
	assetPreferences: AssetPreferencesServerSchema.catch(ASSET_PREFERENCES_DEFAULT),
	characterModifiers: CharacterModifierSystemDataSchema.optional(),
});

export const CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES = [
	'accessId',
	'currentSpace',
] as const satisfies readonly (keyof ICharacterData)[];
export type ICharacterDataDirectoryUpdate = Partial<Pick<ICharacterData, (typeof CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES)[number]>>;
export const CharacterDataDirectoryUpdateSchema: z.ZodType<ICharacterDataDirectoryUpdate> = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();

/** Properties of character data that Shard is allowed to update */
export const CHARACTER_SHARD_UPDATEABLE_PROPERTIES = [
	'name',
	'profileDescription',
	'appearance',
	'personalSpace',
	'settings',
	'interactionConfig',
	'assetPreferences',
	'characterModifiers',
] as const satisfies readonly Exclude<keyof ICharacterData, ((typeof CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES)[number])>[];
export type ICharacterDataShardUpdate = Partial<Pick<ICharacterData, (typeof CHARACTER_SHARD_UPDATEABLE_PROPERTIES)[number]>>;
export const CharacterDataShardUpdateSchema: z.ZodType<ICharacterDataShardUpdate> = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_UPDATEABLE_PROPERTIES, true)).partial();

/** Properties of character data that Shard is allowed to access */
export const CHARACTER_SHARD_VISIBLE_PROPERTIES = [
	...CHARACTER_SHARD_UPDATEABLE_PROPERTIES,
	'id',
	'accountId',
	'accessId',
	'inCreation',
	'created',
] as const satisfies readonly (keyof ICharacterData)[];
export type ICharacterDataShard = Pick<ICharacterData, (typeof CHARACTER_SHARD_VISIBLE_PROPERTIES)[number]>;
export const CharacterDataShardSchema: z.ZodType<ICharacterDataShard> = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_VISIBLE_PROPERTIES, true));

export interface CharacterSelfInfo {
	id: CharacterId;
	name: string;
	state: string;
	currentSpace: SpaceId | null;
	inCreation?: true;
}
export const CharacterSelfInfoSchema: z.ZodObject<ZodObjectShape<CharacterSelfInfo>> = z.object({
	id: CharacterIdSchema,
	name: z.string(),
	state: z.string(),
	currentSpace: SpaceIdSchema.nullable(),
	inCreation: z.literal(true).optional(),
});
