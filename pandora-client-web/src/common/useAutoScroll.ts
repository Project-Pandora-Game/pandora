import React, { useState, useRef, useEffect, useCallback, DependencyList } from 'react';
import { useEvent } from './useEvent';

/**
 * @param deps - dependencies to trigger the scroll
 * @returns [ref, scroll, autoScroll]
 *
 * ref - ref to be attached to the element to be scrolled
 *
 * scroll - function to scroll to the bottom of the element, if autoScroll is true
 *
 * autoScroll - boolean to indicate if the element should be scrolled automatically
 */
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
			ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
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
		current.scrollTo({ top: current.scrollHeight, behavior: 'auto' });
		current.style.scrollBehavior = 'smooth';
		current.addEventListener('scroll', onScroll);
		return () => {
			current.removeEventListener('scroll', onScroll);
		};
	}, [onScroll]);

	return [ref, scroll, autoScroll];
}
