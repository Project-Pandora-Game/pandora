import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMounted } from './useMounted.ts';

/**
 * Creates a stable function that wont change during the lifecycle of the component.
 * @param callback - The function to memoize.
 * @see https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
 */
export function useEvent<R, Args extends unknown[]>(callback: (...args: Args) => R): (...args: Args) => R {
	const ref = useRef<(...args: Args) => R>(callback);

	useLayoutEffect(() => {
		ref.current = callback;
	});

	return useCallback((...event: Args) => {
		const { current } = ref;
		return current(...event);
	}, []);
}

export function useAsyncEvent<R, Args extends unknown[]>(
	callback: (...args: Args) => Promise<R>,
	updateComponent: ((result: R) => void) | null,
	{
		errorHandler,
		updateAfterUnmount = false,
		allowMultipleSimultaneousExecutions = false,
	}: {
		errorHandler?: (error: unknown) => void;
		/** If update should trigger even after the component was unmounted */
		updateAfterUnmount?: boolean;
		/**
		 * If multiple simultaneous calls are allowed. If false, then calls while one is pending are ignored.
		 * @default false
		 */
		allowMultipleSimultaneousExecutions?: boolean;
	} = {},
): [(...args: Args) => void, processing: boolean] {
	const [processing, setProcessing] = useState<number>(0);
	const mounted = useMounted();

	return [useEvent((...args: Args) => {
		if (!allowMultipleSimultaneousExecutions && processing > 0)
			return;

		setProcessing((previousProcessing) => previousProcessing + 1);

		callback(...args)
			.then((result: R) => {
				if (updateAfterUnmount || mounted.current) {
					setProcessing((previousProcessing) => previousProcessing - 1);
					updateComponent?.(result);
				}
			})
			.catch((e) => {
				if (updateAfterUnmount || mounted.current) {
					setProcessing((previousProcessing) => previousProcessing - 1);
					errorHandler?.(e);
				}
			});
	}), processing > 0];
}
