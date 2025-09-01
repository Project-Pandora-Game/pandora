import type { Immutable } from 'immer';
import * as z from 'zod';
import { KnownObject, ParseArrayNotEmpty } from './misc.ts';

const PANDORA_FONTS_SETUP = {
	inter: {
		name: 'Inter',
		cssSelector: `'Inter', 'Arial', sans-serif`,
	},
	arial: {
		name: 'Arial',
		cssSelector: `'Arial', sans-serif`,
	},
	timesNewRoman: {
		name: 'Times New Roman',
		cssSelector: `'Times New Roman', serif`,
	},
	courierNew: {
		name: 'Courier New',
		cssSelector: `'Courier New', monospace`,
	},
	brushScript: {
		name: 'Brush Script MT',
		cssSelector: `'Brush Script MT', cursive`,
	},
} as const satisfies Immutable<Record<string, PandoraFontMetadata>>;

export type PandoraFontMetadata = {
	name: string;
	cssSelector: string;
};

export const PandoraFontTypeSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(PANDORA_FONTS_SETUP)));
export type PandoraFontType = keyof typeof PANDORA_FONTS_SETUP;

export const PANDORA_FONTS: Immutable<Record<PandoraFontType, PandoraFontMetadata>> = Object.freeze(PANDORA_FONTS_SETUP);
