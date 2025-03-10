import { debounce } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';

export function useDebouncedValue<T>(value: T, wait: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	const update = useMemo(() => debounce(setDebouncedValue, wait), [wait]);

	useEffect(() => {
		update(value);
	}, [update, value]);

	return debouncedValue;
}
