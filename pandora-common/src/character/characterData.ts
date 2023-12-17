import { z } from 'zod';
import { AppearanceBundleSchema } from '../assets/state/characterState';
import { CharacterNameSchema, HexColorStringSchema, ZodTruncate } from '../validation';
import { CharacterId, CharacterIdSchema } from './characterTypes';
import { PronounKeySchema } from './pronouns';
import { RoomId } from '../chatroom';
import { InteractionSystemDataSchema } from '../gameLogic/interactions/interactionData';
import { AccountIdSchema } from '../account';
import { ASSET_PREFERENCES_DEFAULT, AssetPreferencesSchema } from './assetPreferences';
import { ArrayToRecordKeys } from '../utility';
import { RoomInventoryBundleSchema } from '../assets';

// Fix for pnpm resolution weirdness
import type { } from '../assets/item';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits';

export const CharacterPublicSettingsSchema = z.object({
	labelColor: HexColorStringSchema.catch('#ffffff'),
	pronoun: PronounKeySchema.catch('she'),
});
export type ICharacterPublicSettings = z.infer<typeof CharacterPublicSettingsSchema>;

export const CHARACTER_DEFAULT_PUBLIC_SETTINGS: Readonly<ICharacterPublicSettings> = {
	labelColor: '#ffffff',
	pronoun: 'she',
};

/** Data about character, that is visible to everyone in same room */
export const CharacterPublicDataSchema = z.object({
	id: CharacterIdSchema,
	accountId: AccountIdSchema,
	name: CharacterNameSchema,
	profileDescription: z.string().default('').transform(ZodTruncate(LIMIT_CHARACTER_PROFILE_LENGTH)),
	settings: CharacterPublicSettingsSchema.default(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
	assetPreferences: AssetPreferencesSchema.default(ASSET_PREFERENCES_DEFAULT),
});
/** Data about character, that is visible to everyone in same room */
export type ICharacterPublicData = z.infer<typeof CharacterPublicDataSchema>;

export type ICharacterMinimalData = Pick<ICharacterPublicData, 'id' | 'name' | 'accountId'>;

/** Data about character, that is visible only to the character itself */
export const CharacterPrivateDataSchema = CharacterPublicDataSchema.extend({
	inCreation: z.literal(true).optional(),
	created: z.number(),
});
/** Data about character, that is visible only to the character itself */
export type ICharacterPrivateData = z.infer<typeof CharacterPrivateDataSchema>;

export const CharacterRoomPositionSchema = z.tuple([z.number(), z.number(), z.number()])
	.catch([-1, -1, 0])
	.readonly();
export type CharacterRoomPosition = readonly [x: number, y: number, yOffset: number];

/** Data about character, as seen by server */
export const CharacterDataSchema = CharacterPrivateDataSchema.extend({
	accessId: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	personalRoomInventory: z.lazy(() => RoomInventoryBundleSchema).optional(),
	interactionConfig: InteractionSystemDataSchema.optional(),
	roomId: z.string().nullable().optional().catch(undefined),
	position: CharacterRoomPositionSchema,
});
/** Data about character, as seen by server */
export type ICharacterData = z.infer<typeof CharacterDataSchema>;

export const CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES = [
	'accessId',
] as const satisfies readonly (keyof ICharacterData)[];
export const CharacterDataDirectoryUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataDirectoryUpdate = z.infer<typeof CharacterDataDirectoryUpdateSchema>;

export const CHARACTER_SHARD_UPDATEABLE_PROPERTIES = [
	'name',
	'profileDescription',
	'appearance',
	'personalRoomInventory',
	'position',
	'roomId',
	'settings',
	'interactionConfig',
	'assetPreferences',
] as const satisfies readonly Exclude<keyof ICharacterData, ((typeof CHARACTER_DIRECTORY_UPDATEABLE_PROPERTIES)[number])>[];
export const CharacterDataShardUpdateSchema = CharacterDataSchema.pick(ArrayToRecordKeys(CHARACTER_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type ICharacterDataShardUpdate = z.infer<typeof CharacterDataShardUpdateSchema>;

export type ICharacterSelfInfo = {
	id: CharacterId;
	name: string;
	preview: string;
	state: string;
	currentRoom?: RoomId | null;
	inCreation?: true;
};

export type ICharacterSelfInfoUpdateProperties = 'preview' | 'currentRoom';
export type ICharacterSelfInfoUpdate = Pick<ICharacterSelfInfo, 'id'> & Partial<Pick<ICharacterSelfInfo, ICharacterSelfInfoUpdateProperties>>;
