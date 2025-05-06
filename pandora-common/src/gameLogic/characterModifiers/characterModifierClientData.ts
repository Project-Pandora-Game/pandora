import { z } from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes.ts';
import { CharacterModifierEffectDataSchema } from './characterModifierData.ts';
import { KnownObject } from '../../utility/misc.ts';
import { cloneDeep, isEqual } from 'lodash-es';

export const SpaceCharacterModifierEffectDataSchema = z.record(CharacterIdSchema, CharacterModifierEffectDataSchema.array());
export type SpaceCharacterModifierEffectData = z.infer<typeof SpaceCharacterModifierEffectDataSchema>;

export const SpaceCharacterModifierEffectDataUpdateSchema = z.record(CharacterIdSchema, CharacterModifierEffectDataSchema.array().nullable());
export type SpaceCharacterModifierEffectDataUpdate = z.infer<typeof SpaceCharacterModifierEffectDataUpdateSchema>;

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
