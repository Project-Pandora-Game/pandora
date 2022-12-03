import { useEffect } from 'react';

export function useKeyDownEvent(
	callback: (event: KeyboardEvent) => void,
	key?: string,
) {
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (!key || event.key === key) {
				callback(event);
			}
		};

		document.addEventListener('keydown', handler);

		return () => {
			document.removeEventListener('keydown', handler);
		};
	}, [key, callback]);
}
