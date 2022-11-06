import classNames from 'classnames';
import React, { ForwardedRef, ReactElement, useState, useEffect, useImperativeHandle, forwardRef, RefObject, useCallback, useRef } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useEvent } from '../../common/useEvent';
import { useMounted } from '../../common/useMounted';
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

	const positionRef = useContextMenuPosition({ left: anchorPoint.x, top: anchorPoint.y });
	const finalRef = useCallback((div: HTMLDivElement | null) => {
		self.current = div;
		positionRef(div);
	}, [positionRef]);

	if (!show)
		return null;

	return (
		<div className={ classNames('context-menu', className) } ref={ finalRef }>
			{ children }
		</div>
	);
}

export const ContextMenu = forwardRef<ContextMenuHandle, CommonProps>(ContextMenuImpl);

export function useContextMenu(): [RefObject<ContextMenuHandle>, (event: React.MouseEvent<HTMLDivElement>) => void, () => void] {
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
export function useContextMenuPosition({ top, left }: { top: number, left: number }): (ref: HTMLElement | null) => void {
	return useCallback((ref: HTMLElement | null) => {
		if (ref) {
			const rect = ref.getBoundingClientRect();
			if (top + rect.height > window.innerHeight) {
				ref.style.top = `${window.innerHeight - rect.height}px`;
			} else {
				ref.style.top = `${top}px`;
			}
			if (left + rect.width > window.innerWidth) {
				ref.style.left = `${window.innerWidth - rect.width}px`;
			} else {
				ref.style.left = `${left}px`;
			}
		}
	}, [top, left]);
}
