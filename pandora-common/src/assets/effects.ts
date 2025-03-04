import { z } from 'zod';
import type { HearingImpairmentSettings, MuffleSettings } from '../character/speech';
import { KnownObject, ParseArrayNotEmpty, type Satisfies } from '../utility/misc';

//#region Effects definition

/**
 * The effects definition should be shallow structure, containing only named `number` or `boolean`.
 */
export type EffectsDefinition = MuffleSettings & HearingImpairmentSettings & {
	/**
	 * Prevents character from adding and removing items
	 */
	blockHands: boolean;

	/**
	 * Prevents character from moving herself within the room, even if admin.
	 * Moving others as admin is still possible.
	 */
	blockRoomMovement: boolean;

	/**
	 * Prevents character from leaving the room.
	 * Note that character can still be kicked/banned out of the space or is removed if the space itself gets destroyed.
	 */
	blockRoomLeave: boolean;

	/**
	 * Blinds the character.
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely blind
	 */
	blind: number;
};

export const EFFECTS_DEFAULT: EffectsDefault = {

	// muffle
	lipsTouch: 0,
	jawMove: 0,
	tongueRoof: 0,
	mouthBreath: 0,
	throatBreath: 0,
	coherency: 0,
	stimulus: 0,

	// hearing impairment
	distortion: 0,
	frequencyLoss: 0,
	vowelLoss: 0,
	middleLoss: 0,

	// others
	blockHands: false,
	blockRoomMovement: false,
	blockRoomLeave: false,
	blind: 0,
};

export const EFFECT_NAMES: Record<EffectName, string> = {
	// muffle
	lipsTouch: 'Muffle: Lips related sounds',
	jawMove: 'Muffle: Jaws related sounds',
	tongueRoof: 'Muffle: Tongue related sounds',
	mouthBreath: 'Muffle: Air breath sounds',
	throatBreath: 'Muffle: Strong throat vibration sounds',
	coherency: 'Muffle: Hinting letters',
	stimulus: 'Stuttering',

	// hearing impairment
	distortion: 'Hearing: Distortion',
	frequencyLoss: 'Hearing: Frequency loss',
	vowelLoss: 'Hearing: Vowel loss',
	middleLoss: 'Hearing: Middle loss',

	// others
	blockHands: 'Blocks hands',
	blockRoomMovement: 'Blocks room movement',
	blockRoomLeave: 'Blocks leaving space',
	blind: 'Blindness',
};

//#endregion

export const EffectNameSchema = z.enum<EffectName, [EffectName, ...EffectName[]]>(ParseArrayNotEmpty(KnownObject.keys(EFFECT_NAMES)));
export type EffectName = keyof EffectsDefinition;

type __satisfies__EffectsDefinition = Satisfies<EffectsDefinition, Record<EffectName, number | boolean>>;
type __satisfies__EFFECTS_DEFAULT = Satisfies<typeof EFFECTS_DEFAULT, EffectsDefinition>;

type EffectsDefault = {
	readonly [e in EffectName]: EffectsDefinition[e] extends number ? 0 : EffectsDefinition[e] extends boolean ? false : never;
};

export function MergeEffects(baseEffects: Readonly<EffectsDefinition>, add: Readonly<Partial<EffectsDefinition>> | undefined): EffectsDefinition {
	if (!add)
		return baseEffects;
	const baseEffectsResult: Record<string, number | boolean> = { ...baseEffects };
	for (const [effect, value] of Object.entries(add)) {
		const current = baseEffectsResult[effect];
		if (typeof current === 'number' && typeof value === 'number') {
			baseEffectsResult[effect] = current + value;
		} else if (typeof current === 'boolean' && typeof value === 'boolean') {
			baseEffectsResult[effect] = current || value;
		}
	}
	return baseEffectsResult as EffectsDefinition;
}
