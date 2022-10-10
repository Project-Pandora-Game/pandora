import type { MuffleSettings } from '../character/speech';
import type { Satisfies } from '../utility';

//#region Effects definition

/**
 * The effects definition should be shallow structure, containing only named `number` or `boolean`.
 */
export type EffectsDefinition = MuffleSettings & {
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

	// others
	blockHands: false,
	blockRoomMovement: false,
	blind: 0,
};

//#endregion

export type EffectName = keyof EffectsDefinition;

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__EffectsDefinition = Satisfies<EffectsDefinition, Record<EffectName, number | boolean>>;

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__EFFECTS_DEFAULT = Satisfies<typeof EFFECTS_DEFAULT, EffectsDefinition>;

type EffectsDefault = {
	readonly [e in EffectName]: EffectsDefinition[e] extends number ? 0 : EffectsDefinition[e] extends boolean ? false : never;
};

export type EffectsProperty = {
	[e in EffectName]?: Exclude<EffectsDefinition[e], false | 0>;
};

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__EffectsProperty = Satisfies<EffectsProperty, Partial<EffectsDefinition>>;

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
