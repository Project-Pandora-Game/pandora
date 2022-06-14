import { useRef, useLayoutEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VoidFunction = (...args: any[]) => void;

/**
 * Creates a stable function that wont change during the lifecycle of the component.
 * @param callback - The function to memoize.
 * @see https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
 */
export function useEvent<T extends VoidFunction>(callback: T): T {
	const ref = useRef<T>();

	useLayoutEffect(() => {
		ref.current = callback;
	});

	return useCallback((...event: Parameters<T>) => {
		const fn = ref.current;
		if (fn)
			return fn(...event);

		throw new Error(`No callback for event ${JSON.stringify(event)}`);
	}, []) as T;
}
