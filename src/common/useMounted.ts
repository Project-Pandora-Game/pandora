import { useRef, useEffect, RefObject } from 'react';

export function useMounted(): RefObject<boolean> {
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	return mounted;
}
