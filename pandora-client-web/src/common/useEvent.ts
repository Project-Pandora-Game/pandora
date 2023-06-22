import { useRef, useLayoutEffect, useCallback, useState } from 'react';
import { useMounted } from './useMounted';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFunction = (...args: any[]) => Promise<any>;

/**
 * Creates a stable function that wont change during the lifecycle of the component.
 * @param callback - The function to memoize.
 * @see https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
 */
export function useEvent<T extends AnyFunction>(callback: T): T {
	const ref = useRef<T>();

	useLayoutEffect(() => {
		ref.current = callback;
	});

	return useCallback((...event: Parameters<T>) => {
		const fn = ref.current;
		if (fn)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return fn(...event);

		throw new Error(`No callback for event ${JSON.stringify(event)}`);
	}, []) as T;
}

export function useAsyncEvent<T extends PromiseFunction>(callback: (...args: Parameters<T>) => ReturnType<T>, updateComponent: (result: Awaited<ReturnType<T>>) => void, { errorHandler }: { errorHandler?: (error: unknown) => void; } = {}): [(...args: Parameters<T>) => void, boolean] {
	const [processing, setProcessing] = useState(false);
	const mounted = useMounted();

	return [useEvent((...args: Parameters<T>) => {
		if (processing)
			return;

		setProcessing(true);

		callback(...args)
			.then((result: Awaited<ReturnType<T>>) => {
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
