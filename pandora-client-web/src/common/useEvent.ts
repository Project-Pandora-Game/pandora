import { useRef, useLayoutEffect, useCallback, useState } from 'react';
import { useMounted } from './useMounted';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFunction = () => Promise<any>;

export function useAsyncEvent<T extends PromiseFunction>(callback: T, updateComponent: (result: Awaited<ReturnType<T>>) => void, { errorHandler }: { errorHandler?: (error: unknown) => void } = {}): [() => Promise<void>, boolean] {
	const [processing, setProcessing] = useState(false);
	const mounted = useMounted();

	return [useEvent(async () => {
		if (processing)
			return;

		setProcessing(true);

		let success = false;
		let result: Awaited<ReturnType<T>>;
		try {
			result = await callback() as Awaited<ReturnType<T>>;
			success = true;
		} catch (e) {
			if (mounted.current) {
				setProcessing(false);
				errorHandler?.(e);
			}
			return;
		}
		if (!mounted.current) {
			return;
		}
		setProcessing(false);

		if (success)
			updateComponent(result);
	}), processing];
}
