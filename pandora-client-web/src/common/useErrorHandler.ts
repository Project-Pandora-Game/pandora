import { useState } from 'react';

export function useErrorHandler(synchronousError?: unknown): (asyncError: unknown) => void {
	const [asyncError, setAsyncError] = useState<unknown>(null);
	if (synchronousError) {
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw synchronousError;
	} else if (asyncError) {
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw asyncError;
	}
	return setAsyncError;
}
