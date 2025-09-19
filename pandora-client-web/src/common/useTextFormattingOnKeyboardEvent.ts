import React from 'react';
import { useWrappedRef } from './useWrappedRef.ts';

export function useTextFormattingOnKeyboardEvent(originalRef: React.ForwardedRef<HTMLTextAreaElement>): React.RefObject<HTMLTextAreaElement | null> {
	const ref = useWrappedRef(originalRef);

	React.useEffect(() => {
		if (ref.current == null)
			return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!e.ctrlKey || ref.current == null || document.activeElement !== ref.current || ref.current.disabled || ref.current.readOnly)
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
	let before = text.substring(0, selectionStart);
	let after = text.substring(selectionEnd);
	const selected = text.substring(selectionStart, selectionEnd);

	if (before.endsWith(format) && after.startsWith(format)) {
		// Do a removal instead of adding the format string to the selection, if already present (act as a toggle)
		before = before.substring(0, before.length - format.length);
		after = after.substring(format.length);
	} else {
		before += format;
		after = format + after;
	}

	textarea.value = before + selected + after;
	const cursorStart = before.length;
	const cursorEnd = cursorStart + selected.length;
	textarea.setSelectionRange(cursorStart, cursorEnd);
}
