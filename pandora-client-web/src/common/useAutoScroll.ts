import React, { useState, useRef, useEffect, useCallback, DependencyList } from 'react';
import { useEvent } from './useEvent';

export function useAutoScroll<Element extends HTMLElement>(deps: DependencyList = []): [
	React.RefObject<Element>,
	() => void,
	boolean,
] {
	const ref = useRef<Element>(null);
	const isScrolling = useRef<boolean>(false);
	const [autoScroll, setAutoScroll] = useState(true);

	const onScroll = useEvent((ev: Event) => {
		if (ref.current && ev.target === ref.current) {
			const onEnd = ref.current.scrollTop + ref.current.offsetHeight + 1 >= ref.current.scrollHeight;
			if (onEnd) {
				isScrolling.current = false;
			}
			setAutoScroll(onEnd || isScrolling.current);
		}
	});

	const scroll = useCallback(() => {
		if (ref.current && autoScroll && ref.current.scrollHeight > 0) {
			isScrolling.current = true;
			ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'auto' });
		}
	}, [autoScroll]);

	useEffect(() => {
		scroll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scroll, ...deps]);

	useEffect(() => {
		if (!ref.current) {
			return undefined;
		}
		const current = ref.current;
		current.style.scrollBehavior = 'smooth';
		current.addEventListener('scroll', onScroll);
		return () => {
			current.removeEventListener('scroll', onScroll);
		};
	}, [onScroll]);

	return [ref, scroll, autoScroll];
}
