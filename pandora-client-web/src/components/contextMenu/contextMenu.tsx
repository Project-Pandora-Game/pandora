import classNames from 'classnames';
import { clamp } from 'lodash-es';
import React, { ForwardedRef, forwardRef, ReactElement, RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CommonProps } from '../../common/reactTypes.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useMounted } from '../../common/useMounted.ts';
import { Column } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import './contextMenu.scss';

type ContextMenuHandle = {
	onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
	close: () => void;
};

let closeLastContextMenu: null | (() => void) = null;

function ContextMenuImpl({ children, className }: CommonProps, ref: ForwardedRef<ContextMenuHandle>): ReactElement | null {
	const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
	const [show, setShow] = useState(false);
	const self = useRef<HTMLDivElement | null>(null);
	const mounted = useMounted();

	const onContextMenu = useEvent((event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
		event.preventDefault();
		closeLastContextMenu?.();
		closeLastContextMenu = () => {
			if (mounted.current) {
				setShow(false);
			}
			closeLastContextMenu = null;
		};
		setAnchorPoint({ x: event.pageX, y: event.pageY });
		setShow(true);
	});

	const cancel = useEvent((event: Event) => {
		if (self.current && !self.current.contains(event.target as Node)) {
			event.stopPropagation();
			event.preventDefault();
			setShow(false);
		}
	});

	useEffect(() => {
		if (!show)
			return;

		document.addEventListener('click', cancel);
		document.addEventListener('contextmenu', cancel);

		return () => {
			document.removeEventListener('click', cancel);
			document.removeEventListener('contextmenu', cancel);
		};
	}, [cancel, show]);

	useImperativeHandle(ref, () => {
		return {
			onContextMenu,
			close: () => setShow(false),
		};
	}, [onContextMenu]);

	const positionRef = useContextMenuPosition(anchorPoint);
	const finalRef = useCallback((div: HTMLDivElement | null) => {
		self.current = div;
		positionRef(div);
	}, [positionRef]);

	if (!show)
		return null;

	return (
		<div className={ classNames('context-menu', className) } ref={ finalRef }>
			<Scrollable>
				<Column>
					{ children }
				</Column>
			</Scrollable>
		</div>
	);
}

export const ContextMenu = forwardRef<ContextMenuHandle, CommonProps>(ContextMenuImpl);

export function useContextMenu(): [RefObject<ContextMenuHandle | null>, (event: React.MouseEvent<HTMLDivElement>) => void, () => void] {
	const ref = useRef<ContextMenuHandle>(null);
	const onContextMenu = useEvent((event: React.MouseEvent<HTMLDivElement>) => {
		// Ignore custom context menu when holding shift
		if (event.shiftKey)
			return;
		ref.current?.onContextMenu(event);
	});
	const close = useEvent(() => ref.current?.close());
	return [ref, onContextMenu, close];
}

/**
 * Postion the element without overflowing the window at bottom or right
 * @param ref The element to position
 * @param position The position to use, object doesn't need to be stable
 */
export function useContextMenuPosition({ x, y }: {
	readonly x: number;
	readonly y: number;
}, {
	xLocation = 'right',
	yLocation = 'down',
}: {
	readonly xLocation?: 'left' | 'center' | 'right';
	readonly yLocation?: 'up' | 'center' | 'down';
} = {}): (ref: HTMLElement | null) => void {
	const elementRef = useRef<HTMLElement | null>(null);

	const update = useCallback(() => {
		const ref = elementRef.current;
		if (!ref)
			return;

		const rect = ref.getBoundingClientRect();

		let finalY = y;
		if (yLocation === 'up') {
			finalY -= rect.height;
		} else if (yLocation === 'center') {
			finalY -= Math.round(rect.height / 2);
		}
		finalY = clamp(finalY, 0, window.innerHeight - rect.height);
		ref.style.top = `${finalY}px`;

		let finalX = x;
		if (xLocation === 'left') {
			finalX -= rect.width;
		} else if (xLocation === 'center') {
			finalX -= Math.round(rect.width / 2);
		}
		finalX = clamp(finalX, 0, window.innerWidth - rect.width);
		ref.style.left = `${finalX}px`;
	}, [x, y, xLocation, yLocation]);

	const observer = useMemo(() => new ResizeObserver(update), [update]);

	return useCallback((newRef: HTMLElement | null) => {
		if (elementRef.current) {
			observer.unobserve(elementRef.current);
			elementRef.current = null;
		}
		if (newRef) {
			elementRef.current = newRef;
			observer.observe(newRef);
			update();
		}
	}, [update, observer]);
}
