export * from './characterTypes';
export * from './pronouns';
export * from './restrictionsManager';
export * from './speech';

import { z } from 'zod';
import { AppearanceBundleSchema } from '../assets/state/characterState';
import { HexColorStringSchema } from '../validation';
import { CharacterId, CharacterIdSchema } from './characterTypes';
import { PronounKeySchema } from './pronouns';
import { ZodTransformReadonly } from '../utility';
import { RoomId } from '../chatroom';

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
	accountId: z.number(),
	name: z.string(),
	settings: CharacterPublicSettingsSchema.default(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
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

/** Data about character, as seen by server */
export const CharacterDataSchema = CharacterPrivateDataSchema.extend({
	accessId: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	roomId: z.string().optional(),
	position: z.tuple([z.number(), z.number()])
		.default([-1, -1])
		.transform(ZodTransformReadonly),
});
/** Data about character, as seen by server */
export type ICharacterData = z.infer<typeof CharacterDataSchema>;

export const CharacterDataCreateSchema = CharacterDataSchema.pick({ name: true });
export type ICharacterDataCreate = z.infer<typeof CharacterDataCreateSchema>;
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
