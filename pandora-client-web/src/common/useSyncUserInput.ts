import { DependencyList, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useEvent } from './useEvent.ts';

export function useSyncUserInput<T extends string | number | boolean>(
	subscribe: (onStoreChange: () => void) => () => void,
	getSnapshot: () => T,
	deps: DependencyList = [],
): [T, (newValue: T) => void] {
	const originalValue = useSyncExternalStore(subscribe, getSnapshot);
	return useUpdatedUserInput(originalValue, deps);
}

export function useUpdatedUserInput<T extends string | number | boolean | undefined | null>(
	originalValue: T,
	deps: DependencyList = [],
): [T, (newValue: T) => void] {
	const [value, setValue] = useState(originalValue);
	const lastSetValue = useRef(originalValue);
	const shouldUpdate = useRef(true);

	useEffect(() => {
		shouldUpdate.current = true;
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
		setValue(newValue);
	});

	return [value, updateValue];
}
