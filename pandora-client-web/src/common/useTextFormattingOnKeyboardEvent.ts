import React from 'react';
import { useWrappedRef } from './useWrappedRef';

export function useTextFormattingOnKeyboardEvent(originalRef: React.ForwardedRef<HTMLTextAreaElement>): React.RefObject<HTMLTextAreaElement> {
	const ref = useWrappedRef(originalRef);

	React.useEffect(() => {
		if (ref.current == null)
			return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!e.ctrlKey || ref.current == null || document.activeElement !== ref.current)
				return;

			switch (e.key) {
				case 'i':
					e.preventDefault();
					FormatSelection(ref.current, '_');
					break;
				case 'b':
					e.preventDefault();
					FormatSelection(ref.current, '__');
					break;
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [ref]);

	return ref;
}

function FormatSelection(textarea: HTMLTextAreaElement, format: string) {
	const selectionStart = textarea.selectionStart;
	const selectionEnd = textarea.selectionEnd;

	const text = textarea.value;
	const before = text.substring(0, selectionStart);
	const selected = text.substring(selectionStart, selectionEnd);
	const after = text.substring(selectionEnd);

	textarea.value = before + format + selected + format + after;

	const cursorPosition = selectionEnd + format.length;
	textarea.setSelectionRange(cursorPosition, cursorPosition);
}
