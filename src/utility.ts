/** Checks if the two types are equal */
export type Equals<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends
	(<T>() => T extends Y ? 1 : 2) ? true : false;

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

declare const window: unknown;
declare const document: Record<string, unknown>;
declare const process: Record<string, Record<string, unknown>>;

/** True if the environment is a browser */
export const IS_BROWSER = typeof window === 'object' && typeof document === 'object' && document.nodeType === 9 && !(typeof process === 'object' && !!process.versions && !!process.versions.node);
/** True if the environment is a node */
export const IS_NODE = !IS_BROWSER;

/**
 * Assert all arguments are `never`
 *
 * Useful for checking all possible outcomes are handled
 */
export function AssertNever(...args: never[]): never {
	throw new Error(`Never assertion failed with arguments: ${args.join(', ')}`);
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

