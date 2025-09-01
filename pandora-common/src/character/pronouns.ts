import * as z from 'zod';
import type { ChatActionDictionaryMetaEntry } from '../chat/index.ts';
import type { Satisfies } from '../utility/misc.ts';

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

export type PronounKey = (keyof typeof PRONOUNS) & string;

export const PronounKeySchema = z.enum(Object.keys(PRONOUNS) as [PronounKey, ...PronounKey[]]);

type MetaKeys<K extends ChatActionDictionaryMetaEntry> = K extends `${infer PREFIX}_${Uppercase<keyof Pronouns>}` ? (`${PREFIX}_${Uppercase<keyof Pronouns>}` extends ChatActionDictionaryMetaEntry ? PREFIX : never) : never;

export function AssignPronouns<K extends MetaKeys<ChatActionDictionaryMetaEntry>, VExtra = never>(prefix: K, pronounKey: PronounKey, pronouns: Partial<Record<ChatActionDictionaryMetaEntry, string | VExtra>>): void {
	for (const [key, value] of Object.entries(PRONOUNS[pronounKey])) {
		const newKey: ChatActionDictionaryMetaEntry = `${prefix}_${key.toUpperCase() as Uppercase<keyof Pronouns>}`;
		pronouns[newKey] = value;
	}
}

type __satisfies__PRONOUNS = Satisfies<typeof PRONOUNS, Record<PronounKey, Pronouns>>;
