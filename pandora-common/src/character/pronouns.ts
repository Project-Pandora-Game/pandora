import type { Satisfies } from '../utility';

export type Pronouns = {
	subjective: string;
	objective: string;
	possessive: string;
	reflexive: string;
};

export const PRONOUNS = {
	she: {
		subjective: 'she',
		objective: 'her',
		possessive: 'her',
		reflexive: 'herself',
	},
	he: {
		subjective: 'he',
		objective: 'him',
		possessive: 'his',
		reflexive: 'himself',
	},
	they: {
		subjective: 'they',
		objective: 'them',
		possessive: 'their',
		reflexive: 'themself',
	},
} as const;

export type PronounKey = keyof typeof PRONOUNS;

type PronounTypes = Uppercase<keyof Pronouns>;

export function AssignPronouns<K extends string, T extends Partial<Record<`${K}_${PronounTypes}`, string>>>(prefix: K, pronounKey: PronounKey, pronouns: T): void {
	for (const [key, value] of Object.entries(PRONOUNS[pronounKey])) {
		const newKey = `${prefix}_${key.toUpperCase()}` as `${K}_${PronounTypes}`;
		// @ts-expect-error - We know this is a valid key
		pronouns[newKey] = value;
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__PRONOUNS = Satisfies<typeof PRONOUNS, Record<PronounKey, Pronouns>>;
// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__PronounKey = Satisfies<{ [K in PronounKey]: typeof PRONOUNS[K]['subjective'] }, { [K in typeof PRONOUNS[PronounKey]['subjective']]: K }>;
