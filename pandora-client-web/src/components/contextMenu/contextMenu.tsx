import classNames from 'classnames';
import React, { ForwardedRef, ReactElement, useState, createRef, useEffect, useImperativeHandle, CSSProperties, useMemo, forwardRef, RefObject } from 'react';
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

	const style = useMemo(() => ({
		left: anchorPoint.x,
		top: anchorPoint.y,
	}), [anchorPoint]) as CSSProperties;

	if (!show)
		return null;

	return (
		<div className={ classNames('context-menu', className) } style={ style } ref={ self }>
			{ children }
		</div>
	);
}

export const ContextMenu = forwardRef<ContextMenuHandle, CommonProps>(ContextMenuImpl);

export function useContextMenu(): [RefObject<ContextMenuHandle>, (event: React.MouseEvent<HTMLDivElement>) => void, () => void] {
	const ref = createRef<ContextMenuHandle>();
	const onContextMenu = useEvent((event: React.MouseEvent<HTMLDivElement>) => ref.current?.onContextMenu(event));
	const close = useEvent(() => ref.current?.close());
	return [ref, onContextMenu, close];
}
