import { isEqual } from 'lodash-es';
import { Assert, KnownObject } from './misc.ts';

/**
 * Calculates a delta of two objects. Does not allow for optional properties.
 * @param base
 * @param target
 */
export function CalculateObjectKeysDelta<T extends object>(base: T, target: NoInfer<Required<T>>): Partial<T> | undefined {
	let result: Partial<T> | undefined;

	for (const key of Object.keys(base)) {
		Assert(Object.hasOwn(target, key));
	}

	for (const [key, value] of KnownObject.entries(target)) {
		if (!isEqual(base[key], value)) {
			result ??= {};
			result[key] = value;
		}
	}

	return result;
}
