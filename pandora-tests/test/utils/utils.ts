// Only utility functions should be used from pandora-common for testing
// Avoid using more complex code - tests should be as simple and straightforward as possible

import { test } from '@playwright/test';

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

export function TestStep<Args extends unknown[], Return, This extends object>(method: (...args: Args) => Promise<Return>, context: ClassMethodDecoratorContext<This>) {
	return function (this: This, ...args: Args) {
		const name = `${this.constructor.name}::${(context.name as string)}`;

		return test.step(name, async () => {
			return await method.call(this, ...args);
		}, { box: true });
	};
}
