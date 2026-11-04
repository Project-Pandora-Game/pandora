import { ForwardedRef, RefObject, useMemo } from 'react';

export function useWrappedRef<Element extends HTMLElement>(originalRef: ForwardedRef<Element>): RefObject<Element | null> {
	return useMemo(() => {
		let current: Element | null = null;
		return {
			get current(): Element | null {
				return current;
			},
			set current(value: Element | null) {
				if (current === value)
					return;

				current = value;

				if (typeof originalRef === 'function')
					originalRef(value);
				else if (originalRef != null)
					originalRef.current = value;
			},
		};
	}, [originalRef]);
}
