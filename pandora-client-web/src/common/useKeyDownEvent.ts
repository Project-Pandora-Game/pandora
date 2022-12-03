import { useEffect } from 'react';

export function useKeyDownEvent(
	key: string,
	callback: (event: KeyboardEvent) => void,
) {
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.key === key) {
				callback(event);
			}
		};

		document.addEventListener('keydown', handler);

		return () => {
			document.removeEventListener('keydown', handler);
		};
	}, [key, callback]);
}
