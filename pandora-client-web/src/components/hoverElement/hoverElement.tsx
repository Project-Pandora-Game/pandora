import classNames from 'classnames';
import React, { ReactElement, RefObject, useEffect, useState } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import './hoverElement.scss';

type HoverElementProps = CommonProps & {
	parent: RefObject<HTMLElement>;
};

const IS_MOUSE_DETECTED = window.matchMedia('(hover: hover)').matches;

export function HoverElement({ children, className, parent }: HoverElementProps): ReactElement | null {
	const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!parent.current)
			return;

		const current = parent.current;

		if (!IS_MOUSE_DETECTED) {
			const start = (event: TouchEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setAnchorPoint({ x: event.touches[0].pageX, y: event.touches[0].pageY });
				setShow(true);
			};
			const end = (event: TouchEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setShow(false);
			};
			current.addEventListener('touchstart', start);
			current.addEventListener('touchend', end);
			return () => {
				current.removeEventListener('touchstart', start);
				current.removeEventListener('touchend', end);
			};
		} else {
			const enter = (event: MouseEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setAnchorPoint({ x: event.pageX, y: event.pageY });
				setShow(true);
			};
			const leave = (event: MouseEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setShow(false);
			};
			const move = (event: MouseEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setAnchorPoint({ x: event.pageX, y: event.pageY });
			};
			current.addEventListener('mouseenter', enter);
			current.addEventListener('mouseleave', leave);
			current.addEventListener('mousemove', move);
			return () => {
				current.removeEventListener('mouseenter', enter);
				current.removeEventListener('mouseleave', leave);
				current.removeEventListener('mousemove', move);
			};
		}
	}, [parent]);

	const positionRef = useContextMenuPosition({ left: anchorPoint.x, top: anchorPoint.y });

	if (!show)
		return null;

	return (
		<div className={ classNames('hover-element', className) } ref={ positionRef }>
			{ children }
		</div>
	);
}
