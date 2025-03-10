import { DependencyList, useEffect, useRef, useState } from 'react';
import { useEvent } from './useEvent.ts';

export interface RemotelyUpdatedUserInputOptions<T extends string | number | boolean | undefined | null> {
	/**
	 * Time without input after which the input resets to the remote value.
	 * @default 1000
	 */
	resetTimer?: number;
	updateCallback?: (newValue: T) => void;
}

export function useRemotelyUpdatedUserInput<T extends string | number | boolean | undefined | null>(
	originalValue: T,
	deps: DependencyList = [],
	{
		resetTimer = 1000,
		updateCallback,
	}: RemotelyUpdatedUserInputOptions<T> = {},
): [T, (newValue: T) => void] {
	const [value, setValue] = useState(originalValue);
	const lastSetValue = useRef(originalValue);
	const shouldUpdate = useRef(true);
	const resetTimeout = useRef<null | number>(null);

	const resetValue = useEvent(() => {
		if (resetTimeout.current != null) {
			clearTimeout(resetTimeout.current);
			resetTimeout.current = null;
		}
		shouldUpdate.current = true;
		setValue(originalValue);
	});

	useEffect(() => {
		resetValue();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	useEffect(() => {
		if (originalValue === lastSetValue.current) {
			shouldUpdate.current = true;
		} else if (shouldUpdate.current) {
			lastSetValue.current = originalValue;
			setValue(originalValue);
		}
	}, [originalValue]);

	const updateValue = useEvent((newValue: T) => {
		shouldUpdate.current = originalValue === newValue;
		lastSetValue.current = newValue;
		if (resetTimeout.current != null) {
			clearTimeout(resetTimeout.current);
			resetTimeout.current = null;
		}
		if (!shouldUpdate.current) {
			resetTimeout.current = setTimeout(resetValue, resetTimer);
		}
		setValue(newValue);
		updateCallback?.(newValue);
	});

	return [value, updateValue];
}
