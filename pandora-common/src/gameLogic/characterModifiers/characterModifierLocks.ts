import type { Immutable } from 'immer';
import { LockDataBundleSchema, type LockSetup } from '../locks/index.ts';
import { z } from 'zod';
import { KnownObject, ParseArrayNotEmpty } from '../../utility/index.ts';

export interface CharacterModifierLockDefinition {
	name: string;
	lockSetup: LockSetup;
}

const CHARACTER_MODIFIER_LOCK_DEFINITIONS_INTERNAL = {
	dummy: {
		name: 'Dummy Lock',
		lockSetup: {},
	},
	exclusive: {
		name: 'Exclusive Lock',
		lockSetup: {
			blockSelf: 'locked',
		},
	},
	password: {
		name: 'Password Lock',
		lockSetup: {
			password: {
				length: [3, 8],
				format: 'alphanumeric',
			},
		},
	},
	timer: {
		name: 'Timer Lock',
		lockSetup: {
			timer: {
				maxDuration: 24 * 60 * 60 * 1000,
			},
		},
	},
} as const satisfies Immutable<Record<string, CharacterModifierLockDefinition>>;

export const CharacterModifierLockTypeSchema = z.enum(ParseArrayNotEmpty(
	KnownObject.keys(CHARACTER_MODIFIER_LOCK_DEFINITIONS_INTERNAL),
));
export type CharacterModifierLockType = z.infer<typeof CharacterModifierLockTypeSchema>;

export const CHARACTER_MODIFIER_LOCK_DEFINITIONS: Immutable<Record<CharacterModifierLockType, CharacterModifierLockDefinition>> =
	CHARACTER_MODIFIER_LOCK_DEFINITIONS_INTERNAL;

export const CharacterModifierLockSchema = z.object({
	lockType: CharacterModifierLockTypeSchema,
	lockData: LockDataBundleSchema,
});
