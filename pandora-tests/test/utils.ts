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

export function AssertNotNullable<T>(value: T | null | undefined): asserts value is NonNullable<T> {
	if (value === null || value === undefined) {
		throw new Error('Value is null or undefined');
	}
}
