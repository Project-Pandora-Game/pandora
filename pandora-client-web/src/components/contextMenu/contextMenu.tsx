import classNames from 'classnames';
import React, { ForwardedRef, ReactElement, useState, createRef, useEffect, useImperativeHandle, useMemo, forwardRef, RefObject, useLayoutEffect } from 'react';
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
	const self = createRef<HTMLDivElement>();
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

	const position = useMemo(() => ({
		left: anchorPoint.x,
		top: anchorPoint.y,
	}), [anchorPoint]);

	usePositionWitoutOverflow(self, position);

	if (!show)
		return null;

	return (
		<div className={ classNames('context-menu', className) } ref={ self }>
			{ children }
		</div>
	);
}

export const ContextMenu = forwardRef<ContextMenuHandle, CommonProps>(ContextMenuImpl);

export function useContextMenu(): [RefObject<ContextMenuHandle>, (event: React.MouseEvent<HTMLDivElement>) => void, () => void] {
	const ref = createRef<ContextMenuHandle>();
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
 */
export function usePositionWitoutOverflow(ref: RefObject<HTMLElement>, pos: { top: number, left: number }): void {
	useLayoutEffect(() => {
		if (ref.current) {
			const rect = ref.current.getBoundingClientRect();
			if (rect.bottom > window.innerHeight) {
				ref.current.style.top = `${pos.top - (rect.bottom - window.innerHeight)}px`;
			}
			if (rect.right > window.innerWidth) {
				ref.current.style.left = `${pos.left - (rect.right - window.innerWidth)}px`;
			}
		}
	}, [ref, pos]);
}
