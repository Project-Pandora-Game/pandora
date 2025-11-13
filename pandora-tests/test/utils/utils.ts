// Only utility functions should be used from pandora-common for testing
// Avoid using more complex code - tests should be as simple and straightforward as possible

export {
	Assert,
	AssertNever,
	AssertNotNullable,
} from 'pandora-common/utility';

export {
	EnvStringify,
} from 'pandora-common/environment';

/** Sleep for certain amount of milliseconds */
export function Sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
