import { z } from 'zod';
import { AppearanceBundleSchema } from '../assets/state/characterState';
import { CharacterNameSchema, HexColorStringSchema, ZodTruncate } from '../validation';
import { CharacterId, CharacterIdSchema } from './characterTypes';
import { PronounKeySchema } from './pronouns';
import { RoomId } from '../chatroom';
import { InteractionSystemDataSchema } from '../gameLogic/interactions/interactionData';
import { AccountIdSchema } from '../account';
import { AssetIdSchema } from '../assets';

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

/** Data about character, that is visible to everyone in same room */
export const CharacterPublicDataSchema = z.object({
	id: CharacterIdSchema,
	accountId: AccountIdSchema,
	name: CharacterNameSchema,
	profileDescription: z.string().default('').transform(ZodTruncate(LIMIT_CHARACTER_PROFILE_LENGTH)),
	settings: CharacterPublicSettingsSchema.default(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
	preferences: AssetPreferencesSchema.default(ASSET_PREFERENCES_DEFAULT),
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
	interactionConfig: InteractionSystemDataSchema.optional(),
	roomId: z.string().optional(),
	position: CharacterRoomPositionSchema,
});
/** Data about character, as seen by server */
export type ICharacterData = z.infer<typeof CharacterDataSchema>;

export const CharacterDataAccessSchema = CharacterDataSchema.pick({ id: true, accessId: true });
export type ICharacterDataAccess = z.infer<typeof CharacterDataAccessSchema>;
export const CharacterDataUpdateSchema = CharacterDataSchema.omit({ inCreation: true, accountId: true, created: true }).partial().merge(CharacterDataAccessSchema);
export type ICharacterDataUpdate = z.infer<typeof CharacterDataUpdateSchema>;
export const CharacterDataIdSchema = CharacterDataSchema.pick({ id: true });
export type ICharacterDataId = z.infer<typeof CharacterDataIdSchema>;

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
