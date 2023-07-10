import { useRef, useLayoutEffect, useCallback, useState } from 'react';
import { useMounted } from './useMounted';

/**
 * Creates a stable function that wont change during the lifecycle of the component.
 * @param callback - The function to memoize.
 * @see https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
 */
export function useEvent<R, Args extends unknown[]>(callback: (...args: Args) => R): (...args: Args) => R {
	const ref = useRef<(...args: Args) => R>();

	useLayoutEffect(() => {
		ref.current = callback;
	});

	return useCallback((...event: Args) => {
		const fn = ref.current;
		if (fn)
			return fn(...event);

		throw new Error(`No callback for event ${JSON.stringify(event)}`);
	}, []);
}

export function useAsyncEvent<R, Args extends unknown[]>(
	callback: (...args: Args) => Promise<R>,
	updateComponent: (result: R) => void,
	{ errorHandler }: { errorHandler?: (error: unknown) => void; } = {},
): [(...args: Args) => void, boolean] {
	const [processing, setProcessing] = useState(false);
	const mounted = useMounted();

	return [useEvent((...args: Args) => {
		if (processing)
			return;

		setProcessing(true);

		callback(...args)
			.then((result: R) => {
				if (mounted.current) {
					setProcessing(false);
					updateComponent(result);
				}
			})
			.catch((e) => {
				if (mounted.current) {
					setProcessing(false);
					errorHandler?.(e);
				}
			});
	}), processing];
}
