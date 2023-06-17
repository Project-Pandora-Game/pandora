import { useCallback, useDebugValue, useMemo, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
	const match = useMemo(() => window.matchMedia(query), [query]);

	const subscribe = useCallback((onChange: () => void) => {
		match.addEventListener('change', onChange);

		return () => {
			match.removeEventListener('change', onChange);
		};
	}, [match]);

	const getValue = useCallback(() => match.matches, [match]);

	const matches = useSyncExternalStore(subscribe, getValue);

	useDebugValue(matches);
	return matches;
}
