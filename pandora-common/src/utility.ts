import AsyncLock, { AsyncLockOptions } from 'async-lock';
import { castDraft, Draft } from 'immer';
import { cloneDeep } from 'lodash';

/** Checks if the two types are equal */
export type Equals<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends
	(<T>() => T extends Y ? 1 : 2) ? true : false;

export type Satisfies<T extends U, U> = T;

export type IsTrueType<T extends true> = T;

export type MembersFirstArg<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends ((arg: infer U, ...rest: any[]) => unknown) ? U : never;
};

export type MemberReturnType<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends ((...arg: any[]) => infer U) ? U : never;
};

export type BoolSelect<T extends boolean, TrueType, FalseType> = T extends true ? TrueType : FalseType;

/** Returns all keys which have values matching V */
export type KeysMatching<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

export type Awaitable<T> = T | PromiseLike<T>;

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export type Nullable<T> = T | null | undefined;

/**
 * Describes the allowed return value from a class `accessor` field decorator.
 * @template This The `this` type to which the target applies.
 * @template Key The kez od the property for the class `accessor` field.
 */
export interface ClassNamedAccessorDecoratorContext<
	This,
	Key extends (keyof This & (string | symbol)),
> extends ClassAccessorDecoratorContext<This, This[Key]> {
	/** The name of the decorated class element. */
	readonly name: Key;
}

declare const window: unknown;
declare const document: Record<string, unknown>;
declare const process: Record<string, Record<string, unknown>>;

/** True if the environment is a browser */
export const IS_BROWSER = typeof window === 'object' && typeof document === 'object' && document.nodeType === 9 && !(typeof process === 'object' && !!process.versions && !!process.versions.node);
/** True if the environment is a node */
export const IS_NODE = !IS_BROWSER;

/** Immutable, always empty array */
export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

/** A `true` usable to prevent narrowing */
export const NOT_NARROWING_TRUE: boolean = true;

/** A `false` usable to prevent narrowing */
export const NOT_NARROWING_FALSE: boolean = false;

export function Assert(condition: unknown, msg?: string): asserts condition {
	if (!condition) {
		throw new Error(msg ? `Assetion failed: ${msg}` : 'Assertion failed');
	}
}

/**
 * Assert all arguments are `never`
 *
 * Useful for checking all possible outcomes are handled
 */
export function AssertNever(...args: never[]): never {
	throw new Error(`Never assertion failed with arguments: ${args.join(', ')}`);
}

export function IsNotNullable<T>(value: T): value is NonNullable<T> {
	return value != null;
}

export function AssertNotNullable<T>(value: Nullable<T>): asserts value is NonNullable<T> {
	if (value === null || value === undefined) {
		throw new Error('Value is null or undefined');
	}
}

/** Asserts that passed array is not empty */
export function AssertArrayNotEmpty<T>(value: T[]): asserts value is [T, ...T[]] {
	if (value.length === 0) {
		throw new Error('Value is empty array');
	}
}

/** Asserts that passed array is not empty and returns it, useful for Zod enum */
export function ParseArrayNotEmpty<T>(value: T[]): [T, ...T[]] {
	AssertArrayNotEmpty(value);
	return value;
}

/**
 * Compresses an object into an array of its values
 * @template T The type of the object
 * @template K an array of the keys of the object
 * @template Transform optional transform object overrides the type of the values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArrayCompressType<T, K extends readonly (keyof T)[], Transform extends Partial<Record<keyof T, any>> = { /* empty */ }> = {
	[N in keyof K]: K[N] extends keyof Transform ? Transform[K[N]] : K[N] extends keyof T ? T[K[N]] : never;
};

export function ArrayToRecordKeys<const T extends string, const V>(keys: readonly T[], value: V): Record<T, V> {
	// @ts-expect-error: Created to match in loop
	const result: Record<T, V> = {};

	keys.forEach((v) => result[v] = value);

	return result;
}

export function NaturalListJoin(list: string[]): string {
	let res = list.pop() ?? '';
	if (list.length > 0) {
		res = `${list.join(', ')} and ${res}`;
	}
	return res;
}

/**
 * Shuffles an array in-place
 * @param array The array to shuffle
 */
export function ShuffleArray<T extends unknown[]>(array: T): T {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export function SplitStringFirstOccurrence(input: string, separator: string): [string, string] {
	const index = input.indexOf(separator);
	return index < 0 ? [input, ''] : [input.substring(0, index), input.substring(index + 1)];
}

/**
 * Returns longest preffix all input strings have in common (case sensitive)
 */
export function LongestCommonPrefix(strings: string[]): string {
	if (strings.length === 0) return '';

	strings = strings.slice().sort();
	let i = 0;
	while (i < strings[0].length && strings[0][i] === strings[strings.length - 1][i]) {
		i++;
	}
	return strings[0].substring(0, i);
}

/** Formats time in ms into days, hours minutes and seconds - also has a short mode that only shows the largest unit, e.g. 17h */
export function FormatTimeInterval(time: number, mode: 'full' | 'short' = 'full') {
	let res = '';
	if (time < 0) {
		res = '-';
		time *= -1;
	}
	const seconds = Math.floor(time / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (mode === 'full') {
		const parts: string[] = [];
		if (days > 0) {
			parts.push(`${days} day${days > 1 ? 's' : ''}`);
		}
		if (hours % 60 > 0) {
			parts.push(`${hours % 24} hour${hours > 1 ? 's' : ''}`);
		}
		if (minutes % 60 > 0) {
			parts.push(`${minutes % 60} minute${minutes > 1 ? 's' : ''}`);
		}
		if (seconds % 60 > 0 || parts.length === 0) {
			parts.push(`${seconds % 60} second${seconds > 1 ? 's' : ''}`);
		}
		res += parts.join(', ');
	} else if (mode === 'short') {
		if (days > 1) {
			res += `${days}d`;
		} else if (hours > 1) {
			res += `${hours}h`;
		} else if (minutes > 1) {
			res += `${minutes}m`;
		} else {
			res += `${seconds}s`;
		}
	}
	return res;
}

export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

/**
 * Converts a time value in specified unit to milliseconds
 * @param time The time value
 * @param unit The unit of the time value
 * @returns The time value in milliseconds
 * @note This function is not precise for months and years as they have varying length
 */
export function TimeSpanMs(time: number, unit: TimeUnit): number {
	switch (unit) {
		case 'milliseconds':
			return time;
		case 'seconds':
			return time * 1000;
		case 'minutes':
			return time * 1000 * 60;
		case 'hours':
			return time * 1000 * 60 * 60;
		case 'days':
			return time * 1000 * 60 * 60 * 24;
		case 'weeks':
			return time * 1000 * 60 * 60 * 24 * 7;
		case 'months':
			return time * 1000 * 60 * 60 * 24 * 30;
		case 'years':
			return time * 1000 * 60 * 60 * 24 * 365;
	}
}

export function MessageSubstitute(originalMessage: string, substitutions: Readonly<Record<string, string>>): string {
	let message = originalMessage;
	for (const [key, value] of Object
		.entries(substitutions)
		// Do the longest substitutions first to avoid small one replacing part of large one
		.sort(([a], [b]) => b.length - a.length)
	) {
		message = message.replaceAll(key, value);
	}
	return message;
}

/**
 * Create a deep copy of the data, marking it as mutable if it was originally immutable
 * @param data - Data to clone
 * @returns New, mutable copy of data
 * @note The `Draft` type on return is used as it means making data mutable, it comes from the `immer` library
 */
export function CloneDeepMutable<T>(data: T): Draft<T> {
	return castDraft(cloneDeep(data));
}

export type ManuallyResolvedPromise<T> = {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

export function CreateManuallyResolvedPromise<T>(): ManuallyResolvedPromise<T> {
	let resolve!: ManuallyResolvedPromise<T>['resolve'];
	let reject!: ManuallyResolvedPromise<T>['reject'];
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, resolve, reject };
}

const AsyncSynchronizedObjectLocks = new WeakMap<object, AsyncLock>();

/**
 * Synchronizes calls to the asynchronous method.
 *
 * Only one call per instance runs at a time, other calls waiting in queue for the first call to finish (either resolve or reject)
 * @param options - Options passed directly to the `async-lock` library, or if `object` that the method synchronizes with all 'object' synchronized methods within instance
 */
export function AsyncSynchronized(options?: AsyncLockOptions | 'object') {
	if (options === 'object') {
		return function <Args extends unknown[], Return, This extends object>(method: (...args: Args) => Promise<Return>, _context: ClassMethodDecoratorContext<This>) {
			return function (this: This, ...args: Args) {
				let lock = AsyncSynchronizedObjectLocks.get(this);
				if (lock == null) {
					lock = new AsyncLock({
						maxExecutionTime: 60_000,
					});
					AsyncSynchronizedObjectLocks.set(this, lock);
				}

				return lock.acquire<Return>('', () => method.apply(this, args));
			};
		};
	}
	return function <Args extends unknown[], Return, This extends object>(method: (...args: Args) => Promise<Return>, _context: ClassMethodDecoratorContext<This>) {
		const locks = new WeakMap<object, AsyncLock>();

		return function (this: This, ...args: Args) {
			let lock = locks.get(this);
			if (lock == null) {
				lock = new AsyncLock({
					maxExecutionTime: 60_000,
					...options,
				});
				locks.set(this, lock);
			}

			return lock.acquire<Return>('', () => method.apply(this, args));
		};
	};
}

/**
 * List of sorted, non-overlapping intervals
 */
export type ReadonlyIntervalSet = readonly (readonly [number, number])[];

/**
 * List of sorted, non-overlapping intervals
 */
export type IntervalSet = [number, number][];

type __satisfies__IntervalSet = Satisfies<IntervalSet, ReadonlyIntervalSet>;

/**
 * Parameters must be sorted and non-overlapping intervals (e.g. [[1, 2], [3, 4]])
 * @param a The first interval set
 * @param b The second interval set
 */
export function IntervalSetIntersection(a: ReadonlyIntervalSet, b: ReadonlyIntervalSet): IntervalSet {
	const res: IntervalSet = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const [aMin, aMax] = a[i];
		const [bMin, bMax] = b[j];
		if (aMax < bMin) {
			i++;
		} else if (bMax < aMin) {
			j++;
		} else {
			res.push([Math.max(aMin, bMin), Math.min(aMax, bMax)]);
			if (aMax < bMax) {
				i++;
			} else {
				j++;
			}
		}
	}
	return res;
}

/**
 * Parameters must be sorted and non-overlapping intervals (e.g. [[1, 2], [3, 4]])
 * @param a The first interval set
 * @param b The second interval set
 */
export function IntervalSetUnion(a: ReadonlyIntervalSet, b: ReadonlyIntervalSet): IntervalSet {
	const res: IntervalSet = [];
	let i = 0;
	let j = 0;
	const add = (interval: [number, number]) => {
		if (res.length === 0 || res[res.length - 1][1] < interval[0]) {
			res.push(interval);
		} else {
			res[res.length - 1][1] = Math.max(res[res.length - 1][1], interval[1]);
		}
	};
	while (i < a.length && j < b.length) {
		const [aMin, aMax] = a[i];
		const [bMin, bMax] = b[j];
		if (aMax < bMin) {
			add([...a[i]]);
			i++;
		} else if (bMax < aMin) {
			add([...b[j]]);
			j++;
		} else {
			add([Math.min(aMin, bMin), Math.max(aMax, bMax)]);
			i++;
			j++;
		}
	}
	while (i < a.length) {
		add([...a[i]]);
		i++;
	}
	while (j < b.length) {
		add([...b[j]]);
		j++;
	}
	return res;
}

/**
 * Decorates a member function so it memoizes the result of the first call, the function must take no arguments
 */
export function MemoizeNoArg<Return, This extends object>(method: () => Return, _context: ClassMethodDecoratorContext<This>) {
	const cache = new WeakMap<object, Return>();
	return function (this: This) {
		if (cache.has(this)) {
			return cache.get(this)!;
		}
		const result = method.call(this);
		cache.set(this, result);
		return result;
	};
}

export function ZodTransformReadonly<T>(value: T): Readonly<T> {
	return Object.freeze(value);
}

/**
 * Creates a promise that will resolve to the result of the first call to the promise factory
 *
 * On reject the promise will be discarded and the next call will create a new promise
 *
 * @param promise The promise factory
 */
export function PromiseOnce<T>(promise: () => Promise<T>): () => Promise<T> {
	let result: null | [T] = null;
	let promiseResult: Promise<T> | null = null;
	return async () => {
		if (result) {
			return result[0];
		}
		if (promiseResult != null) {
			return promiseResult;
		}
		promiseResult = promise();
		try {
			result = [await promiseResult];
		} finally {
			promiseResult = null;
		}
		return result[0];
	};
}

export type ObjectEntry<T, K extends keyof T> = [K, T[K]];

/**
 * This class provides alternative implementations of `Object.keys`, `Object.values` and `Object.entries`,
 * which have typing as if all possible keys of the object passed to them are known.
 * This results in a more friendly way to iterate through objects where that is the case,
 * but it can still result in an **incorrect behaviour** if you don't know what exactly this does.
 *
 * Use with care.
 */
export class KnownObject {
	public static keys<T extends object>(obj: T): (keyof T)[] {
		return Object.keys(obj) as (keyof T)[];
	}
	public static values<T extends object>(obj: T): T[keyof T][] {
		return Object.values(obj) as T[keyof T][];
	}
	public static entries<T extends object>(obj: T): ObjectEntry<T, keyof T>[] {
		return Object.entries(obj) as ObjectEntry<T, keyof T>[];
	}
}
