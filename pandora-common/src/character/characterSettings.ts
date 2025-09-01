import * as z from 'zod';
import { ArrayToRecordKeys, KnownObject, ParseArrayNotEmpty } from '../utility/misc.ts';
import { HexColorStringSchema } from '../validation.ts';
import { PronounKeySchema } from './pronouns.ts';

//#region Settings declarations

export const CharacterPreviewGenerationSettings = z.object({
	/** Whether preview should automatically update in the background, regularly */
	auto: z.boolean(),
	/** Radius of character canvas area size used for the preview */
	areaSize: z.number().int().nonnegative(),
	areaYOffset: z.number().int().nonnegative(),
});

export const CharacterSettingsSchema = z.object({
	labelColor: HexColorStringSchema,
	pronoun: PronounKeySchema,
	previewGeneration: CharacterPreviewGenerationSettings,
});

export type CharacterSettings = z.infer<typeof CharacterSettingsSchema>;

export const CHARACTER_SETTINGS_DEFAULT = Object.freeze<CharacterSettings>({
	labelColor: '#ffffff',
	pronoun: 'she',
	previewGeneration: {
		auto: true,
		areaSize: 128,
		areaYOffset: 300,
	},
});

export const CHARACTER_PUBLIC_SETTINGS = [
	'labelColor',
	'pronoun',
] as const satisfies readonly (keyof CharacterSettings)[];

//#endregion

export const CharacterSettingsKeysSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(CharacterSettingsSchema.shape)));
export type CharacterSettingsKeys = z.infer<typeof CharacterSettingsKeysSchema>;

export const CharacterPublicSettingsSchema = CharacterSettingsSchema.pick(ArrayToRecordKeys(CHARACTER_PUBLIC_SETTINGS, true));
export type CharacterPublicSettings = z.infer<typeof CharacterPublicSettingsSchema>;
