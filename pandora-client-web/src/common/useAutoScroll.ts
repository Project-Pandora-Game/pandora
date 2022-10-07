import React, { useState, useRef, useEffect, useCallback, DependencyList } from 'react';
import { useEvent } from './useEvent';
import { useUniqueKeyRef } from './useUniqueKeyRef';

export function useAutoScroll<Element extends HTMLElement>(memoKey: string, { deps = [], mounted }: { deps?: DependencyList, mounted?: boolean } = {}): [
	React.RefObject<Element>,
	() => void,
	boolean,
] {
	const ref = useRef<Element>(null);
	const scrollPosition = useUniqueKeyRef(memoKey + '_scrollPosition', 0);
	const isScrolling = useRef<boolean>(false);
	const lastAutoScroll = useUniqueKeyRef(memoKey + '_lastAutoScroll', true);
	const [autoScroll, setAutoScroll] = useState(lastAutoScroll.current);

	const onScroll = useEvent((ev: Event) => {
		if (ref.current && ev.target === ref.current) {
			const onEnd = ref.current.scrollTop + ref.current.offsetHeight + 1 >= ref.current.scrollHeight;
			if (onEnd) {
				isScrolling.current = false;
			}
			scrollPosition.current = ref.current.scrollTop;
			lastAutoScroll.current = onEnd || isScrolling.current;
			setAutoScroll(lastAutoScroll.current);
		}
	});

	const scroll = useCallback(() => {
		if (ref.current && autoScroll && ref.current.scrollHeight > 0) {
			isScrolling.current = true;
			ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'auto' });
			scrollPosition.current = ref.current.scrollHeight;
		}
	}, [autoScroll, scrollPosition]);

	useEffect(() => {
		if (!ref.current) {
			return undefined;
		}
		const current = ref.current;
		setTimeout(() => {
			current.style.scrollBehavior = 'smooth';
		}, 0);
		current.addEventListener('scroll', onScroll);

		if (!lastAutoScroll.current) {
			current.scrollTo({ top: scrollPosition.current, behavior: 'auto' });
		}

		let cleanup: number | undefined;
		if (lastAutoScroll.current && ref.current.scrollHeight === 0) {
			cleanup = setInterval(() => {
				if (ref.current && ref.current.scrollHeight > 0) {
					clearInterval(cleanup);
					cleanup = undefined;
					isScrolling.current = true;
					ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'auto' });
					scrollPosition.current = ref.current.scrollHeight;
				}
			}, 100);
		}
		return () => {
			current.removeEventListener('scroll', onScroll);
			if (cleanup) {
				clearInterval(cleanup);
				cleanup = undefined;
			}
		};
	}, [lastAutoScroll, onScroll, scrollPosition]);

	useEffect(() => {
		scroll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scroll, ...deps]);

	useEffect(() => {
		if (ref.current && mounted) {
			const current = ref.current;
			current.style.scrollBehavior = 'auto';
			current.scrollTo({ top: scrollPosition.current, behavior: 'auto' });
			setTimeout(() => {
				current.style.scrollBehavior = 'smooth';
			}, 0);
		}
	}, [mounted, scrollPosition]);

	return [ref, scroll, autoScroll];
}

