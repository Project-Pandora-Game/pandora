import { z } from 'zod';
import { AccountIdSchema } from '../account/index.ts';
import { AppearanceBundleSchema } from '../assets/state/characterStateTypes.ts';
import { RoomInventoryBundleSchema } from '../assets/state/roomState.ts';
import { CharacterModifierSystemDataSchema } from '../gameLogic/characterModifiers/characterModifierData.ts';
import { InteractionSystemDataSchema } from '../gameLogic/interactions/interactionData.ts';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits.ts';
import { SpaceIdSchema } from '../space/space.ts';
import { ArrayToRecordKeys } from '../utility/misc.ts';
import { CharacterNameSchema, ZodTruncate } from '../validation.ts';
import { ASSET_PREFERENCES_DEFAULT, AssetPreferencesServerSchema } from './assetPreferences.ts';
import { CharacterSettingsSchema } from './characterSettings.ts';
import { CharacterIdSchema } from './characterTypes.ts';

/** Data about character, that is visible to everyone in the same space */
export const CharacterPublicDataSchema = z.object({
	id: CharacterIdSchema,
	accountId: AccountIdSchema,
	name: CharacterNameSchema,
	profileDescription: z.string().default('').transform(ZodTruncate(LIMIT_CHARACTER_PROFILE_LENGTH)),
});
/** Data about character, that is visible to everyone in the same space */
export type ICharacterPublicData = z.infer<typeof CharacterPublicDataSchema>;

export type ICharacterMinimalData = Pick<ICharacterPublicData, 'id' | 'name' | 'accountId'>;

/** Data about character, that is visible only to the character itself */
export const CharacterPrivateDataSchema = CharacterPublicDataSchema.extend({
	inCreation: z.literal(true).optional(),
	created: z.number(),
	/**
	 * Settings of the account.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * Settings modified to the default are saved as well, so potential change of default wouldn't change the user-selected setting.
	 * This lets us both save on stored data, but also change defaults for users that never changed it themselves.
	 * Also lets us show non-default settings to users with a button to reset them.
	 */
	settings: CharacterSettingsSchema.partial(),
});
/** Data about character, that is visible only to the character itself */
export type ICharacterPrivateData = z.infer<typeof CharacterPrivateDataSchema>;

/** Data about character, as seen by server */
export const CharacterDataSchema = CharacterPrivateDataSchema.extend({
	accessId: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	/**
	 * A character preview image, used in the character picker.
	 * Stored as binary data in database.
	 */
	preview: z.unknown().optional(),
	/** The space the character is currently in. `null` means personal space. */
	currentSpace: SpaceIdSchema.nullable().default(null),
	// TODO(spaces): Migrate this to be a personalSpace data
	personalRoom: z.object({
		inventory: z.lazy(() => RoomInventoryBundleSchema),
	}).optional(),
	interactionConfig: InteractionSystemDataSchema.optional(),
	assetPreferences: AssetPreferencesServerSchema.default(ASSET_PREFERENCES_DEFAULT),
	characterModifiers: CharacterModifierSystemDataSchema.optional(),
	// TODO(spaces): Move this to be part of character state (roomId is used to reset position when room changes)
	roomId: z.string().nullable().optional().catch(undefined),
	position: CharacterRoomPositionSchema,

});
/** Data about character, as seen by server */
export type ICharacterData = z.infer<typeof CharacterDataSchema>;

export const CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES = [
	'accessId',
	'currentSpace',
] as const satisfies readonly (keyof ICharacterData)[];
export const CharacterDataDirectoryUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataDirectoryUpdate = z.infer<typeof CharacterDataDirectoryUpdateSchema>;

/** Properties of character data that Shard is allowed to update */
export const CHARACTER_SHARD_UPDATEABLE_PROPERTIES = [
	'name',
	'profileDescription',
	'appearance',
	'personalRoom',
	'settings',
	'interactionConfig',
	'assetPreferences',
	'characterModifiers',
] as const satisfies readonly Exclude<keyof ICharacterData, ((typeof CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES)[number])>[];
export const CharacterDataShardUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataShardUpdate = z.infer<typeof CharacterDataShardUpdateSchema>;

/** Properties of character data that Shard is allowed to access */
export const CHARACTER_SHARD_VISIBLE_PROPERTIES = [
	...CHARACTER_SHARD_UPDATEABLE_PROPERTIES,
	'id',
	'accountId',
	'accessId',
	'inCreation',
	'created',
] as const satisfies readonly (keyof ICharacterData)[];
export const CharacterDataShardSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_VISIBLE_PROPERTIES, true));
export type ICharacterDataShard = z.infer<typeof CharacterDataShardSchema>;

export const CharacterSelfInfoSchema = z.object({
	id: CharacterIdSchema,
	name: z.string(),
	state: z.string(),
	currentSpace: SpaceIdSchema.nullable(),
	inCreation: z.literal(true).optional(),
});
export type CharacterSelfInfo = z.infer<typeof CharacterSelfInfoSchema>;
