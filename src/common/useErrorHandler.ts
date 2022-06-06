import { useState } from 'react';

export function useErrorHandler(synchronousError?: unknown): (asyncError: unknown) => void {
	const [asyncError, setAsyncError] = useState<unknown>(null);
	if (synchronousError) {
		throw synchronousError;
	} else if (asyncError) {
		throw asyncError;
	}
	return setAsyncError;
}
