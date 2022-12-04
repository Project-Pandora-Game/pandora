import { useEffect } from 'react';

/**
 * Registers a keydown handler to the document
 * @param callback - Callback for the handler (can return `true` to stop event propagation)
 * @param key - Optionally a key to filter for; `undefined` means filters are not processed
 */
export function useKeyDownEvent(
	callback: (event: KeyboardEvent) => void | boolean,
	key?: string,
) {
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (!key || event.key === key) {
				const result = callback(event);
				if (result === true) {
					event.stopImmediatePropagation();
					event.preventDefault();
				}
			}
		};

		document.addEventListener('keydown', handler);

		return () => {
			document.removeEventListener('keydown', handler);
		};
	}, [key, callback]);
}
