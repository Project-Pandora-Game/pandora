import React, { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { useEvent } from './useEvent.ts';

/**
 * @param deps - dependencies to trigger the scroll
 * @returns [ref, scroll, autoScroll]
 *
 * ref - ref to be attached to the element to be scrolled
 *
 * scroll - function to scroll to the bottom of the element, if autoScroll is true or directly forced
 *
 * autoScroll - boolean to indicate if the element should be scrolled automatically
 */
export function useAutoScroll<Element extends HTMLElement>(deps: DependencyList = []): [
	React.RefObject<Element | null>,
	(forceScroll: boolean) => void,
	boolean,
] {
	const ref = useRef<Element>(null);
	const isScrolling = useRef<boolean>(false);
	const [autoScroll, setAutoScroll] = useState(true);

	const onScroll = useEvent((ev: Event) => {
		if (ref.current && ev.target === ref.current) {
			const atEnd = isAtEnd();
			if (atEnd) {
				isScrolling.current = false;
			}
			setAutoScroll(atEnd || isScrolling.current);
		}
	});

	const isAtEnd = useCallback(() => {
		if (ref.current) {
			return ref.current.scrollTop + ref.current.offsetHeight + 1 >= ref.current.scrollHeight;
		} else {
			return false;
		}
	}, []);

	const onVisibilityChange = useCallback(() => {
		if (document.visibilityState === 'hidden') {
			setAutoScroll(false);
		} else if (isAtEnd()) {
			setAutoScroll(true);
		}
	}, [isAtEnd]);

	const scroll = useCallback((forceScroll: boolean) => {
		if (ref.current && (autoScroll || forceScroll) && ref.current.scrollHeight > 0) {
			isScrolling.current = true;
			ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
		}
	}, [autoScroll]);

	useEffect(() => {
		scroll(false);
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

	useEffect(() => {
		window.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [onVisibilityChange]);

	return [ref, scroll, autoScroll];
}
