export * from './restrictionsManager';
export * from './speech';

import { z } from 'zod';
import { AppearanceBundleSchema } from '../assets';
import { ZodMatcher, zTemplateString } from '../validation';

export const CharacterIdSchema = zTemplateString<`c${number}`>(z.string(), /^c[1-9][0-9]{0,15}$/);
export type CharacterId = z.infer<typeof CharacterIdSchema>;

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = ZodMatcher(CharacterIdSchema);

export const CharacterPublicSettingsSchema = z.object({
	labelColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type ICharacterPublicSettings = z.infer<typeof CharacterPublicSettingsSchema>;

export const CHARACTER_DEFAULT_PUBLIC_SETTINGS: Readonly<ICharacterPublicSettings> = {
	labelColor: '#ffffff',
};

export const CharacterPublicDataSchema = z.object({
	id: CharacterIdSchema,
	accountId: z.number(),
	name: z.string(),
	appearance: AppearanceBundleSchema.optional(),
	settings: CharacterPublicSettingsSchema,
});

export type ICharacterPublicData = z.infer<typeof CharacterPublicDataSchema>;

export const CharacterDataSchema = CharacterPublicDataSchema.merge(z.object({
	inCreation: z.literal(true).optional(),
	created: z.number(),
	accessId: z.string(),
}));

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
	inCreation?: true;
};

export type ICharacterSelfInfoUpdate = Pick<ICharacterSelfInfo, 'id'> & Partial<Pick<ICharacterSelfInfo, 'preview'>>;
