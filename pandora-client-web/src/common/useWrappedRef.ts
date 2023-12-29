import React from 'react';

export function useWrappedRef<Element extends HTMLElement>(originalRef: React.ForwardedRef<Element>): React.RefObject<Element> {
	return React.useMemo(() => {
		let current = null as Element | null;
		return {
			get current() {
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
