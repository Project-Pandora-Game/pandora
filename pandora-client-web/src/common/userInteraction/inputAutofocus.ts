import { useEffect } from 'react';
import type { IInputBase } from './input/inputBase.tsx';

/**
 * Utility to focus a desired input if there is no input focused when user starts writing on the keyboard
 * @param ref - The input to focus
 */
export function useInputAutofocus(ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | IInputBase | null>): void {
	useEffect(() => {
		const keyPressHandler = (ev: KeyboardEvent) => {
			if (
				ref.current &&
				// Only if no other input is selected
				(!document.activeElement || !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) &&
				// Only if this isn't a special key or key combo
				!ev.ctrlKey &&
				!ev.metaKey &&
				!ev.altKey &&
				ev.key.length === 1
			) {
				ref.current.focus();
			}
		};
		// Use `keydown` event, because the keyup is important - it needs to have target element focused already when it fires
		window.addEventListener('keydown', keyPressHandler, { capture: true });
		return () => {
			window.removeEventListener('keydown', keyPressHandler, { capture: true });
		};
	}, [ref]);
}
