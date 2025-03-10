import { z } from 'zod';
import { AccountIdSchema } from '../account/index.ts';
import { AppearanceBundleSchema } from '../assets/state/characterStateTypes.ts';
import { RoomInventoryBundleSchema } from '../assets/state/roomState.ts';
import { CharacterModifierSystemDataSchema } from '../gameLogic/characterModifiers/characterModifierData.ts';
import { InteractionSystemDataSchema } from '../gameLogic/interactions/interactionData.ts';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits.ts';
import { SpaceIdSchema } from '../space/space.ts';
import { ArrayToRecordKeys } from '../utility/misc.ts';
import { CharacterNameSchema, HexColorStringSchema, ZodTruncate } from '../validation.ts';
import { ASSET_PREFERENCES_DEFAULT, AssetPreferencesServerSchema } from './assetPreferences.ts';
import { CharacterIdSchema } from './characterTypes.ts';
import { PronounKeySchema } from './pronouns.ts';

export const CharacterPublicSettingsSchema = z.object({
	labelColor: HexColorStringSchema.catch('#ffffff'),
	pronoun: PronounKeySchema.catch('she'),
});
export type ICharacterPublicSettings = z.infer<typeof CharacterPublicSettingsSchema>;

export const CHARACTER_DEFAULT_PUBLIC_SETTINGS: Readonly<ICharacterPublicSettings> = {
	labelColor: '#ffffff',
	pronoun: 'she',
};

export const CharacterRoomPositionSchema = z.tuple([z.number().int(), z.number().int(), z.number().int()])
	.catch([0, 0, 0])
	.readonly();
export type CharacterRoomPosition = readonly [x: number, y: number, yOffset: number];

/** Data about character, that is visible to everyone in the same space */
export const CharacterPublicDataSchema = z.object({
	id: CharacterIdSchema,
	accountId: AccountIdSchema,
	name: CharacterNameSchema,
	profileDescription: z.string().default('').transform(ZodTruncate(LIMIT_CHARACTER_PROFILE_LENGTH)),
	settings: CharacterPublicSettingsSchema.default(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
});
/** Data about character, that is visible to everyone in the same space */
export type ICharacterPublicData = z.infer<typeof CharacterPublicDataSchema>;

export type ICharacterMinimalData = Pick<ICharacterPublicData, 'id' | 'name' | 'accountId'>;

/** Data about character, that is visible only to the character itself */
export const CharacterPrivateDataSchema = CharacterPublicDataSchema.extend({
	inCreation: z.literal(true).optional(),
	created: z.number(),
});
/** Data about character, that is visible only to the character itself */
export type ICharacterPrivateData = z.infer<typeof CharacterPrivateDataSchema>;

/** Data about character, as seen by server */
export const CharacterDataSchema = CharacterPrivateDataSchema.extend({
	accessId: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	/**
	 * TODO: Not yet implemented
	 *
	 * A character preview image, used in the character picker.
	 */
	preview: z.string(),
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
	'preview',
	'currentSpace',
] as const satisfies readonly (keyof ICharacterData)[];
export const CharacterDataDirectoryUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataDirectoryUpdate = z.infer<typeof CharacterDataDirectoryUpdateSchema>;

export const CHARACTER_SHARD_UPDATEABLE_PROPERTIES = [
	'name',
	'profileDescription',
	'appearance',
	'personalRoom',
	'position',
	'roomId',
	'settings',
	'interactionConfig',
	'assetPreferences',
	'characterModifiers',
] as const satisfies readonly Exclude<keyof ICharacterData, ((typeof CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES)[number])>[];
export const CharacterDataShardUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataShardUpdate = z.infer<typeof CharacterDataShardUpdateSchema>;

export const CharacterSelfInfoSchema = z.object({
	id: CharacterIdSchema,
	name: z.string(),
	preview: z.string(),
	state: z.string(),
	currentSpace: SpaceIdSchema.nullable(),
	inCreation: z.literal(true).optional(),
});
export type CharacterSelfInfo = z.infer<typeof CharacterSelfInfoSchema>;
