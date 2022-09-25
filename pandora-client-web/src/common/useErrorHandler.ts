import { useState } from 'react';

export function useErrorHandler(synchronousError?: unknown): (asyncError: unknown) => void {
	const [asyncError, setAsyncError] = useState<unknown>(null);
	if (synchronousError) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw synchronousError;
	} else if (asyncError) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw asyncError;
	}
	return setAsyncError;
}
