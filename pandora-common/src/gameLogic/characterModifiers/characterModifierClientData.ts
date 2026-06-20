import { cloneDeep, isEqual } from 'lodash-es';
import * as z from 'zod';
import { CharacterIdSchema, type CharacterId } from '../../character/characterTypes.ts';
import { KnownObject } from '../../utility/misc.ts';
import { CharacterModifierEffectDataSchema, type CharacterModifierEffectData } from './characterModifierData.ts';

export type SpaceCharacterModifierEffectData = Record<CharacterId, CharacterModifierEffectData[]>;
export const SpaceCharacterModifierEffectDataSchema: z.ZodType<SpaceCharacterModifierEffectData> =
	z.record(CharacterIdSchema, CharacterModifierEffectDataSchema.array());

export type SpaceCharacterModifierEffectDataUpdate = Record<CharacterId, CharacterModifierEffectData[] | null>;
export const SpaceCharacterModifierEffectDataUpdateSchema: z.ZodType<SpaceCharacterModifierEffectDataUpdate> =
	z.record(CharacterIdSchema, CharacterModifierEffectDataSchema.array().nullable());

export function SpaceCharacterModifierEffectCalculateUpdate(original: SpaceCharacterModifierEffectData, newData: SpaceCharacterModifierEffectData): SpaceCharacterModifierEffectDataUpdate | undefined {
	let result: SpaceCharacterModifierEffectDataUpdate | undefined;

	for (const character of KnownObject.keys(original)) {
		if (!Object.hasOwn(newData, character)) {
			result ??= {};
			result[character] = null;
		}
	}

	for (const [character, data] of KnownObject.entries(newData)) {
		if (!isEqual(original[character], data)) {
			result ??= {};
			result[character] = cloneDeep(data);
		}
	}

	return result;
}
