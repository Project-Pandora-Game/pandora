import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useEvent } from './useEvent';

export function useSyncUserInput<T extends string | number | boolean>(
	subscribe: (onStoreChange: () => void) => () => void,
	getSnapshot: () => T,
): [T, (newValue: T) => void] {
	const originalValue = useSyncExternalStore(subscribe, getSnapshot);
	const [value, setValue] = useState(originalValue);
	const shouldUpdate = useRef(true);

	useEffect(() => {
		if (originalValue === value) {
			shouldUpdate.current = true;
		} else if (shouldUpdate.current) {
			setValue(originalValue);
		}
	}, [originalValue, value]);

	const updateValue = useEvent((newValue: T) => {
		shouldUpdate.current = originalValue === newValue;
		setValue(newValue);
	});

	return [value, updateValue];
}
