import type { Immutable } from 'immer';
import { EMPTY_ARRAY } from '../utility/misc.ts';
import type { AssetProperties } from './properties.ts';
import type { RoomDeviceProperties } from './roomDeviceProperties.ts';

/**
 * Advanced feature that allows applying additional properties when _all_ state flags of the combination are satisfied.
 * This allows creating more complex "AND" or "OR" condition chains for the asset.
 */
export interface AssetStateFlagCombination<TProperties> {
	/** List of flags that must be present for this combination to take effect. */
	requiredFlags: string[];
	/** Properties that are applied when this combination is active. */
	properties: TProperties;
}

/**
 * Extracts properties of all combinations that should apply.
 * Also checks combinations activated thanks to other combinations
 * @param combinations - The combinations to check
 * @param flags - Flags that are active outside of combinations
 * @param getPropertySetFlags - A function
 * @returns
 */
export function QueryStateFlagCombinations<TProperties>(
	combinations: Immutable<AssetStateFlagCombination<TProperties>[]>,
	flags: Set<string>,
	getPropertySetFlags: (properties: Immutable<TProperties>) => readonly string[],
): readonly Immutable<TProperties>[] {
	const result: Immutable<TProperties>[] = [];
	const used: boolean[] = combinations.map(() => false);

	let needsUpdate = true;

	while (needsUpdate) {
		needsUpdate = false;

		for (let i = 0; i < combinations.length; i++) {
			if (used[i])
				continue;

			const combination = combinations[i];
			if (combination.requiredFlags.every((f) => flags.has(f))) {
				result.push(combination.properties);
				used[i] = true;

				for (const flag of getPropertySetFlags(combination.properties)) {
					if (!flags.has(flag)) {
						flags.add(flag);
						needsUpdate = true;
					}
				}
			}
		}
	}

	return result;
}

export function StateFlagCombinationAssetPropertiesGetter(properties: Immutable<AssetProperties>): readonly string[] {
	return properties.stateFlags?.provides ?? EMPTY_ARRAY;
}

export function StateFlagCombinationRoomDevicePropertiesGetter(properties: Immutable<RoomDeviceProperties>): readonly string[] {
	return properties.stateFlags?.provides ?? EMPTY_ARRAY;
}
