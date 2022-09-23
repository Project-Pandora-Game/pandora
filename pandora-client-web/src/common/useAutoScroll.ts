import { useState, useRef, useMemo, useEffect } from 'react';
import { useEvent } from './useEvent';

export function useAutoScroll<Element extends HTMLElement>(): [
	React.RefObject<Element>,
	(ev: React.UIEvent<Element>) => void,
	{ readonly isScrolling: boolean; },
] {
	const [autoScroll, setAutoScroll] = useState(true);
	const ref = useRef<Element>(null);
	// Needs to be object such that changes don't trigger render
	const memo = useMemo(() => ({ isScrolling: false }), []);

	// Only add the smooth scrolling effect after mount and first scroll
	// to make sure there is no visual glitch when switching back into element
	useEffect(() => {
		setTimeout(() => {
			if (ref.current) {
				ref.current.style.scrollBehavior = 'smooth';
			}
		}, 0);
	}, []);

	const scroll = useEvent(() => {
		if (ref.current && autoScroll) {
			memo.isScrolling = true;
			ref.current.scrollTop = ref.current.scrollHeight;
		}
	});

	useEffect(() => {
		scroll();
	}, [ref, scroll]);

	const onScroll = useEvent((ev: React.UIEvent<Element>) => {
		if (ref.current && ev.target === ref.current) {
			// We should scroll to the end if we are either in progress of scrolling or already on the end
			const onEnd = ref.current.scrollTop + ref.current.offsetHeight + 1 >= ref.current.scrollHeight;
			if (onEnd) {
				memo.isScrolling = false;
			}
			setAutoScroll(onEnd || memo.isScrolling);
		}
	});

	return [ref, onScroll, memo];
}
