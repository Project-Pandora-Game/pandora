import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';

export function useDebouncedValue<T>(value: T, wait: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	const update = useMemo(() => _.debounce(setDebouncedValue, wait), [wait]);

	useEffect(() => {
		update(value);
	}, [update, value]);

	return debouncedValue;
}
